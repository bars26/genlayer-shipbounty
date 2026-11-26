"""Direct-mode tests for ShipBounty: GitHub issue bounties for open-source iOS apps, paid when the fix ships in the
App Store."""

import json
import re
import sys

import pytest

from tests.direct.conftest import CONTRACT_PATH, llm_json, to_hex

GEN = 10**18
AMOUNT = GEN
GH = "https://api.github.com"
REPO = "acme/icecream"
N = 42
APPLE_ID = "6444915884"
APPLE = f"https://itunes.apple.com/lookup?id={APPLE_ID}"
SHA = "a" * 40
NOW = "2026-11-26T12:00:00Z"


def _web(vm, url, body, status=200):
    payload = body if isinstance(body, str) else json.dumps(body)
    vm.mock_web("^" + re.escape(url) + "$", {"method": "GET", "response": {"status": status, "headers": {}, "body": payload.encode()}})


def _issue(state="closed", reason="completed", pr=False, title="Blocked list repeats the first page"):
    d = {"number": N, "title": title, "body": "Scrolling the blocked list shows page one again.", "state": state,
         "state_reason": reason if state == "closed" else None, "closed_at": "2026-10-12T06:57:24Z" if state == "closed" else None}
    if pr:
        d["pull_request"] = {"url": "x"}
    return d


def _timeline(commit=SHA, xref=None):
    events = [{"event": "labeled"}]
    if xref:
        events.append({"event": "cross-referenced", "source": {"issue": xref}})
    events.append({"event": "closed", "commit_id": commit})
    return events


def _pr(number=7, merged="2026-10-12T06:57:23Z", author="ivan", body="Fixes #42"):
    return {"number": number, "merged_at": merged, "merge_commit_sha": SHA, "title": "Use the next-page cursor", "body": body, "user": {"login": author}}


def _release(tag="2.1.6", published="2026-10-13T18:25:39Z", draft=False, pre=False):
    return {"tag_name": tag, "published_at": published, "draft": draft, "prerelease": pre}


def _app(version="2.1.6", released="2026-10-14T18:20:09Z", seller="https://icecream.app"):
    return {"resultCount": 1, "results": [{"kind": "software", "trackName": "Ice Cream", "version": version,
                                            "currentVersionReleaseDate": released, "sellerUrl": seller}]}


def _setup(vm, issue=None, timeline=None, pulls=None, commit=None, releases=None, compare=None, app=None, user_bio="",
           repo=None, readme=f"[App Store](https://apps.apple.com/us/app/ice-cream/id{APPLE_ID})", delivers="FULL",
           issue_status=200, releases_status=200, apple_status=200, extra=()):
    vm.clear_mocks()
    _web(vm, f"{GH}/repos/{REPO}", repo or {"full_name": REPO, "homepage": "https://icecream.app", "archived": False})
    _web(vm, f"https://raw.githubusercontent.com/{REPO}/HEAD/README.md", readme or "", 200 if readme is not None else 404)
    _web(vm, f"{GH}/repos/{REPO}/readme", readme or "", 200 if readme is not None else 404)
    _web(vm, APPLE, app or _app(), apple_status)
    _web(vm, f"{GH}/repos/{REPO}/issues/{N}", issue or _issue(), issue_status)
    _web(vm, f"{GH}/repos/{REPO}/issues/{N}/timeline?per_page=100", timeline if timeline is not None else _timeline())
    _web(vm, f"{GH}/repos/{REPO}/commits/{SHA}/pulls", pulls if pulls is not None else [_pr()])
    _web(vm, f"{GH}/repos/{REPO}/commits/{SHA}", commit or {"commit": {"message": "Handle concealment\n\nCloses #42", "committer": {"date": "2026-10-12T06:57:23Z"}}, "author": {"login": "whattherestimefor"}})
    _web(vm, f"{GH}/repos/{REPO}/releases?per_page=30", releases if releases is not None else [_release(), _release("2.1.5", "2026-10-12T20:00:00Z")], releases_status)
    if compare is None:
        compare = {"2.1.6": "behind", "2.1.5": "ahead"}  # the change is in 2.1.6, not in the 2.1.5 published the evening before
    for r in (releases if releases is not None else [_release(), _release("2.1.5", "2026-10-12T20:00:00Z")]):
        status = compare.get(r["tag_name"], "ahead") if isinstance(compare, dict) else compare
        _web(vm, f"{GH}/repos/{REPO}/compare/{r['tag_name']}...{SHA}", {"status": status})
    for login in ("ivan", "whattherestimefor"):
        _web(vm, f"{GH}/users/{login}", {"login": login, "bio": user_bio})
    for url, body in extra:
        _web(vm, url, body)
    vm.mock_llm(r".*", llm_json({"delivers": delivers, "reason": "It switches to the next-page cursor."}))


def _at(vm, ts):
    vm.warp(ts)
    raw = getattr(sys.modules.get("genlayer.gl"), "message_raw", None)
    if isinstance(raw, dict):
        raw["datetime"] = ts


def _deposit(vm, c, who, amount):
    vm.sender, vm.value = who, amount
    c.deposit()
    vm.value = 0


def _owed(c, who):
    return int(c.owed_to(to_hex(who).lower()))


def _balance(c):
    t = json.loads(c.totals())
    assert int(t["expected_balance"]) == sum(int(t[k]) for k in ("pots", "reserved", "held", "owed"))
    return t


def _open(vm, deploy, who, expect=None, setup=None, deposit=AMOUNT, **terms):
    _at(vm, NOW)
    vm.sender = who
    c = deploy(CONTRACT_PATH)
    _deposit(vm, c, who, deposit)
    _setup(vm, **(setup or {}))
    args = dict(repo=REPO, issue=N, apple_id=APPLE_ID, tag_prefix="", deadline="2027-01-31", survival_days=7, amount=AMOUNT)
    args.update(terms)
    vm.sender = who
    if expect:
        with vm.expect_revert(expect):
            c.open_bounty(*args.values())
        return c, None
    return c, c.open_bounty(*args.values())


def _claim(vm, c, bid, who, expect=None, **setup):
    _setup(vm, **setup)
    vm.sender = who
    if expect:
        with vm.expect_revert(expect):
            c.claim(bid)
        return None
    return c.claim(bid)


@pytest.fixture
def retro(direct_vm, direct_deploy, direct_alice):
    return _open(direct_vm, direct_deploy, direct_alice)


# --- opening -------------------------------------------------------------------------------------------------------------


def test_a_retroactive_bounty_on_a_closed_issue(direct_vm, direct_alice, retro):
    c, bid = retro
    b = c.get_bounty(bid)
    assert (b.repo, int(b.issue), b.app, b.retro, b.state, int(b.pot)) == (REPO, N, "Ice Cream", True, "open", AMOUNT)
    assert json.loads(b.backers_json) == [[to_hex(direct_alice).lower(), str(AMOUNT)]]
    assert json.loads(b.history_json)[0]["link"] == "readme"
    assert c.bounty_for(REPO, N) == bid and _owed(c, direct_alice) == 0
    _balance(c)


def test_a_bounty_on_an_open_issue_is_prospective(direct_vm, direct_deploy, direct_alice):
    c, bid = _open(direct_vm, direct_deploy, direct_alice, setup=dict(issue=_issue("open")))
    assert c.get_bounty(bid).retro is False


def test_a_readme_only_the_api_serves_counts(direct_vm, direct_deploy, direct_alice):
    _at(direct_vm, NOW)
    direct_vm.sender = direct_alice
    c = direct_deploy(CONTRACT_PATH)
    _deposit(direct_vm, c, direct_alice, AMOUNT)
    _setup(direct_vm, app=_app(seller="https://other.example"))
    _web(direct_vm, f"https://raw.githubusercontent.com/{REPO}/HEAD/README.md", "", 404)  # README.rst, say
    bid = c.open_bounty(REPO, N, APPLE_ID, "", "2027-01-31", 7, AMOUNT)
    assert json.loads(c.get_bounty(bid).history_json)[0]["link"] == "readme"


@pytest.mark.parametrize("setup, how", [
    (dict(readme="no link here", repo={"full_name": REPO, "homepage": f"https://apps.apple.com/app/id{APPLE_ID}", "archived": False}), "homepage"),
    (dict(readme="no link here"), "seller_url"),  # the repo's homepage is the app's seller website
])
def test_other_ways_a_repo_names_its_app(direct_vm, direct_deploy, direct_alice, setup, how):
    c, bid = _open(direct_vm, direct_deploy, direct_alice, setup=setup)
    assert json.loads(c.get_bounty(bid).history_json)[0]["link"] == how


@pytest.mark.parametrize("setup, reason", [
    (dict(readme="no link", app=_app(seller="https://other.example")), "does not name App Store app"),
    (dict(readme=f"see apps.apple.com/app/id{APPLE_ID}9", app=_app(seller="https://other.example")), "does not name App Store app"),  # another id
    (dict(repo={"full_name": REPO, "homepage": "", "archived": True}), "does not name App Store app"),
    (dict(issue=_issue(pr=True)), "has no issue"),
    (dict(issue_status=404), "has no issue"),
    (dict(apple_status=500), "could not be read right now"),
])
def test_bad_links_are_refused(direct_vm, direct_deploy, direct_alice, setup, reason):
    _open(direct_vm, direct_deploy, direct_alice, setup=setup, expect=reason)


@pytest.mark.parametrize("terms, reason", [
    (dict(repo="not a repo"), "owner/name"), (dict(apple_id="12"), "apple_id must be"), (dict(tag_prefix="a b"), "tag_prefix must be"),
    (dict(deadline="2026-11-30"), "7 to 365 days ahead"), (dict(deadline="2028-01-01"), "7 to 365 days ahead"),
    (dict(deadline="2027-02-30"), "7 to 365 days ahead"), (dict(survival_days=0), "survival_days must be"), (dict(amount=10), "amount must be"),
])
def test_bad_terms_are_refused(direct_vm, direct_deploy, direct_alice, terms, reason):
    _open(direct_vm, direct_deploy, direct_alice, expect=reason, **terms)


def test_repo_urls_are_accepted_and_one_bounty_per_issue(direct_vm, direct_deploy, direct_alice):
    c, bid = _open(direct_vm, direct_deploy, direct_alice, repo=f"https://github.com/{REPO}/", deposit=2 * AMOUNT)
    assert c.get_bounty(bid).repo == REPO
    _setup(direct_vm)
    with direct_vm.expect_revert("already has a bounty"):
        c.open_bounty(REPO, N, APPLE_ID, "", "2027-01-31", 7, AMOUNT)


def test_backers_add_up_and_are_capped(direct_vm, direct_alice, direct_bob, retro):
    c, bid = retro
    _deposit(direct_vm, c, direct_bob, 3 * AMOUNT)
    direct_vm.sender = direct_bob
    c.back(bid, AMOUNT)
    c.back(bid, AMOUNT)
    b = c.get_bounty(bid)
    assert int(b.pot) == 3 * AMOUNT and len(json.loads(b.backers_json)) == 2
    with direct_vm.expect_revert("deposit first"):
        c.back(bid, 2 * AMOUNT)
    _balance(c)


# --- claims --------------------------------------------------------------------------------------------------------------


def test_a_shipped_fix_reserves_the_pot(direct_vm, direct_bob, retro):
    c, bid = retro
    cid = _claim(direct_vm, c, bid, direct_bob)
    cl = c.get_claim(cid)
    assert (cl.verdict, cl.code, cl.state, int(cl.amount), cl.author, cl.version) == ("SHIPPED", "shipped", "held", AMOUNT, "ivan", "2.1.6")
    assert cl.held_until == "2026-10-21T18:20:09"  # the App Store build plus 7 days
    r = json.loads(cl.reading_json)
    assert r["facts"]["change"]["kind"] == "pr" and r["facts"]["release"]["tag"] == "2.1.6" and r["judged"]["delivers"] == "FULL"
    b = c.get_bounty(bid)
    assert (b.state, int(b.pot), int(b.reserved), b.claim_id) == ("held", 0, AMOUNT, cid)
    _balance(c)


def test_the_release_users_have_must_contain_the_change(direct_vm, direct_bob, retro):
    c, bid = retro
    releases = [_release("2.1.6", "2026-10-13T18:25:39Z"), _release("2.1.5", "2026-10-12T20:00:00Z"), _release("2.1.4", "2026-10-08T06:00:00Z")]
    cid = _claim(direct_vm, c, bid, direct_bob, releases=releases, compare={"2.1.6": "behind", "2.1.5": "identical", "2.1.4": "ahead"},
                 app=_app("2.1.5", "2026-10-13T08:00:00Z"))
    cl = c.get_claim(cid)
    assert (cl.verdict, cl.version) == ("SHIPPED", "2.1.5")  # the App Store has 2.1.5; 2.1.4 predates the merge


def test_a_commit_without_a_pull_request_counts(direct_vm, direct_bob, retro):
    c, bid = retro
    cl = c.get_claim(_claim(direct_vm, c, bid, direct_bob, pulls=[]))
    f = json.loads(cl.reading_json)["facts"]["change"]
    assert (cl.verdict, f["kind"], cl.author) == ("SHIPPED", "commit", "whattherestimefor")


def test_a_merged_pr_with_a_closing_keyword_counts_when_no_commit_closed_it(direct_vm, direct_bob, retro):
    c, bid = retro
    xref = {"number": 9, "title": "Fix pagination", "body": "Closes #42", "pull_request": {"merged_at": "2026-10-12T06:57:23Z"}, "repository": {"full_name": REPO}}
    cid = _claim(direct_vm, c, bid, direct_bob, timeline=_timeline(commit=None, xref=xref),
                 extra=[(f"{GH}/repos/{REPO}/pulls/9", _pr(9, body="Closes #42"))])
    assert c.get_claim(cid).verdict == "SHIPPED"


@pytest.mark.parametrize("setup, verdict, code", [
    (dict(issue=_issue("open")), "INELIGIBLE", "not_closed"),
    (dict(issue=_issue("closed", "not_planned")), "INELIGIBLE", "not_completed"),
    (dict(timeline=_timeline(commit=None)), "INELIGIBLE", "no_change"),
    (dict(timeline=_timeline(commit=None, xref={"number": 9, "title": "Related", "body": "see #42", "pull_request": {"merged_at": "2026-10-12T06:57:23Z"}, "repository": {"full_name": REPO}})), "INELIGIBLE", "no_change"),
    (dict(pulls=[_pr(author="")]), "INELIGIBLE", "no_author"),
    (dict(compare="ahead"), "UNCLEAR", "not_released"),
    (dict(releases=[_release(draft=True), _release("2.1.5", pre=True)]), "UNCLEAR", "not_released"),
    (dict(app=_app("2.1.5")), "UNCLEAR", "not_in_app_store"),
    (dict(app=_app("2.1.6", "2026-10-11T00:00:00Z")), "UNCLEAR", "not_in_app_store"),  # the App Store build predates the merge
    (dict(delivers="NO"), "INELIGIBLE", "not_delivered"),
    (dict(delivers="PARTIAL"), "INELIGIBLE", "partial"),
])
def test_rulings(direct_vm, direct_bob, retro, setup, verdict, code):
    c, bid = retro
    cl = c.get_claim(_claim(direct_vm, c, bid, direct_bob, **setup))
    assert (cl.verdict, cl.code, cl.state, int(cl.amount)) == (verdict, code, "refused", 0)
    assert c.get_bounty(bid).state == "open" and int(c.get_bounty(bid).pot) == AMOUNT


def test_a_prospective_bounty_pays_only_later_work(direct_vm, direct_deploy, direct_alice, direct_bob):
    c, bid = _open(direct_vm, direct_deploy, direct_alice, setup=dict(issue=_issue("open")))
    assert c.get_claim(_claim(direct_vm, c, bid, direct_bob)).code == "before_bounty"  # merged 2026-10-12, bounty 2026-11-26
    later = [_pr(merged="2026-12-01T10:00:00Z")]
    _at(direct_vm, "2026-12-10T00:00:00Z")
    cl = c.get_claim(_claim(direct_vm, c, bid, direct_bob, pulls=later, releases=[_release("2.2.0", "2026-12-02T00:00:00Z")], compare="behind",
                            app=_app("2.2.0", "2026-12-03T00:00:00Z")))
    assert cl.verdict == "SHIPPED"


def test_the_tag_prefix_picks_the_platform(direct_vm, direct_deploy, direct_alice, direct_bob):
    releases = [_release("mac-7.3.1", "2026-11-20T00:00:00Z"), _release("iOS-7.3.1-7244", "2026-11-22T00:00:00Z")]
    c, bid = _open(direct_vm, direct_deploy, direct_alice, tag_prefix="iOS-")
    cl = c.get_claim(_claim(direct_vm, c, bid, direct_bob, releases=releases, compare="behind", app=_app("7.3.1", "2026-11-23T00:00:00Z")))
    assert (cl.verdict, cl.version) == ("SHIPPED", "7.3.1") and json.loads(cl.reading_json)["facts"]["release"]["tag"] == "iOS-7.3.1-7244"


@pytest.mark.parametrize("setup, reason", [
    (dict(issue_status=503), "could not be read right now"),
    (dict(releases_status=403), "could not be read right now"),  # a GitHub rate limit decides nothing
    (dict(issue=_issue(pr=True)), "has no issue"),
])
def test_unreadable_claims_record_nothing(direct_vm, direct_bob, retro, setup, reason):
    c, bid = retro
    _claim(direct_vm, c, bid, direct_bob, expect=reason, **setup)
    assert json.loads(c.get_bounty(bid).history_json)[-1]["event"] == "opened"


def test_a_refused_claim_can_be_made_again(direct_vm, direct_bob, retro):
    c, bid = retro
    assert c.get_claim(_claim(direct_vm, c, bid, direct_bob, app=_app("2.1.5"))).code == "not_in_app_store"
    assert c.get_claim(_claim(direct_vm, c, bid, direct_bob)).verdict == "SHIPPED"  # the App Store caught up
    _claim(direct_vm, c, bid, direct_bob, expect="not open for claims")


# --- confirmation, wallets, disputes -----------------------------------------------------------------------------------


def _shipped(vm, deploy, backer, scout):
    c, bid = _open(vm, deploy, backer)
    return c, bid, _claim(vm, c, bid, scout)


def test_confirm_pays_the_wallet_in_the_authors_bio(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    c, bid, cid = _shipped(direct_vm, direct_deploy, direct_alice, direct_bob)
    _setup(direct_vm, user_bio=f"iOS dev. GenLayer wallet: {to_hex(direct_charlie)}")
    assert c.confirm(cid) == "paid"
    assert _owed(c, direct_charlie) == AMOUNT and c.get_bounty(bid).state == "paid"
    direct_vm.sender = direct_charlie
    assert c.withdraw() == str(AMOUNT)
    _balance(c)


def test_confirm_waits_for_the_survival_period(direct_vm, direct_deploy, direct_alice, direct_bob):
    c, bid = _open(direct_vm, direct_deploy, direct_alice)
    cid = _claim(direct_vm, c, bid, direct_bob, app=_app("2.1.6", "2026-11-25T00:00:00Z"))
    with direct_vm.expect_revert("confirmed from 2026-12-02 00:00:00 UTC"):
        c.confirm(cid)


def test_an_author_without_a_wallet_is_held_then_collected(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    c, bid, cid = _shipped(direct_vm, direct_deploy, direct_alice, direct_bob)
    _setup(direct_vm)
    assert c.confirm(cid) == "awaiting_wallet"
    assert _balance(c)["held"] == str(AMOUNT)
    _setup(direct_vm, user_bio=f"GenLayer wallet: {to_hex(direct_charlie)} and GenLayer wallet: 0x{'ab' * 20}")
    with direct_vm.expect_revert("does not declare one GenLayer wallet yet"):
        c.collect(cid)
    _setup(direct_vm, user_bio=f"GenLayer wallet: {to_hex(direct_charlie)}")
    assert c.collect(cid) == to_hex(direct_charlie).lower()
    assert _owed(c, direct_charlie) == AMOUNT and c.get_claim(cid).state == "paid"
    _balance(c)


@pytest.mark.parametrize("setup", [dict(issue=_issue("open")), dict(app=_app("2.1.5"))])
def test_a_reopened_issue_or_a_pulled_release_reopens_the_bounty(direct_vm, direct_deploy, direct_alice, direct_bob, setup):
    c, bid, cid = _shipped(direct_vm, direct_deploy, direct_alice, direct_bob)
    _setup(direct_vm, **setup)
    assert c.confirm(cid) == "reverted"
    b = c.get_bounty(bid)
    assert (b.state, int(b.pot), int(b.reserved), b.claim_id) == ("open", AMOUNT, 0, "")
    _balance(c)


def test_an_unreadable_source_at_confirmation_changes_nothing(direct_vm, direct_deploy, direct_alice, direct_bob):
    c, bid, cid = _shipped(direct_vm, direct_deploy, direct_alice, direct_bob)
    _setup(direct_vm, apple_status=503)
    with direct_vm.expect_revert("could not be read right now"):
        c.confirm(cid)
    assert c.get_claim(cid).state == "held"


def test_a_dismissed_dispute_pays_its_stake_to_the_author(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    c, bid, cid = _shipped(direct_vm, direct_deploy, direct_alice, direct_bob)
    _deposit(direct_vm, c, direct_alice, AMOUNT // 10)
    _setup(direct_vm)
    direct_vm.sender = direct_alice
    assert c.dispute(cid) == "DISMISSED"
    assert int(c.get_claim(cid).bonus) == AMOUNT // 10
    _setup(direct_vm)
    with direct_vm.expect_revert("disputed already"):
        c.dispute(cid)
    _setup(direct_vm, user_bio=f"GenLayer wallet: {to_hex(direct_charlie)}")
    assert c.confirm(cid) == "paid" and _owed(c, direct_charlie) == AMOUNT + AMOUNT // 10
    _balance(c)


def test_an_upheld_dispute_pays_the_disputer_and_reopens_the_bounty(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    c, bid, cid = _shipped(direct_vm, direct_deploy, direct_alice, direct_bob)
    _deposit(direct_vm, c, direct_charlie, AMOUNT // 10)
    _setup(direct_vm, delivers="PARTIAL")
    direct_vm.sender = direct_charlie
    assert c.dispute(cid) == "UPHELD"
    assert c.get_claim(cid).state == "disputed" and _owed(c, direct_charlie) == 2 * (AMOUNT // 10)
    b = c.get_bounty(bid)
    assert (b.state, int(b.pot), int(b.reserved)) == ("open", AMOUNT - AMOUNT // 10, 0)
    _balance(c)


def test_disputes_need_a_stake_and_a_readable_claim(direct_vm, direct_deploy, direct_alice, direct_bob):
    c, bid, cid = _shipped(direct_vm, direct_deploy, direct_alice, direct_bob)
    _setup(direct_vm)
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("deposit first"):
        c.dispute(cid)
    _deposit(direct_vm, c, direct_bob, AMOUNT // 10)
    _setup(direct_vm, app=_app("2.1.5"))  # unclear now: decides nothing
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("nothing was staked"):
        c.dispute(cid)
    assert _owed(c, direct_bob) == AMOUNT // 10


# --- deadlines -----------------------------------------------------------------------------------------------------------


def test_refunds_after_the_deadline_go_to_each_backer(direct_vm, direct_alice, direct_bob, retro):
    c, bid = retro
    _deposit(direct_vm, c, direct_bob, 3 * AMOUNT)
    direct_vm.sender = direct_bob
    c.back(bid, 3 * AMOUNT)
    with direct_vm.expect_revert("takes claims until 2027-01-31"):
        c.refund(bid)
    _at(direct_vm, "2027-02-01T00:00:00Z")
    _claim(direct_vm, c, bid, direct_bob, expect="took claims until 2027-01-31")
    assert c.refund(bid) == str(4 * AMOUNT)
    assert (_owed(c, direct_alice), _owed(c, direct_bob)) == (AMOUNT, 3 * AMOUNT)
    assert c.get_bounty(bid).state == "refunded"
    _balance(c)


def test_an_uncollected_payment_returns_to_the_backers_after_90_days(direct_vm, direct_deploy, direct_alice, direct_bob):
    c, bid, cid = _shipped(direct_vm, direct_deploy, direct_alice, direct_bob)
    _setup(direct_vm)
    c.confirm(cid)
    with direct_vm.expect_revert("held until 2027-02-24"):
        c.reclaim(cid)
    _at(direct_vm, "2027-02-25T00:00:00Z")
    assert c.reclaim(cid) == str(AMOUNT)
    assert _owed(c, direct_alice) == AMOUNT and c.get_claim(cid).state == "returned"
    _balance(c)


# --- helpers through views -------------------------------------------------------------------------------------------------


@pytest.mark.parametrize("tag, app, shipped", [
    ("2.1.6", "2.1.6", True), ("iOS-7.3.1-7244", "7.3.1", True), ("releases/2026.11.17", "2026.11.17", True),
    ("v2026.11.0-bwpm", "2026.11.1", True), ("2026.08", "2026.08", True), ("2.1.6", "2.1.5", False), ("2.1", "2.1.0", True),
    ("build-355", "2.1.6", False),
])
def test_check_versions(retro, tag, app, shipped):  # noqa: D103
    c, _ = retro
    assert json.loads(c.check_versions(tag, app))["shipped"] is shipped
