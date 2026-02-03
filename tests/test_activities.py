import copy
import urllib.parse

import pytest
from fastapi.testclient import TestClient

from src.app import app, activities

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_activities():
    # Make a deep copy of the in-memory activities and restore after each test
    original = copy.deepcopy(activities)
    yield
    activities.clear()
    activities.update(copy.deepcopy(original))


def test_get_activities():
    res = client.get("/activities")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, dict)
    assert "Chess Club" in data


def test_signup_success():
    email = "testuser@mergington.edu"
    activity_name = "Chess Club"
    url = f"/activities/{urllib.parse.quote(activity_name)}/signup?email={urllib.parse.quote(email)}"
    res = client.post(url)
    assert res.status_code == 200
    assert f"Signed up {email} for {activity_name}" in res.json().get("message", "")
    assert email in activities[activity_name]["participants"]


def test_signup_duplicate_fails():
    email = "michael@mergington.edu"  # already signed up in initial data
    activity_name = "Chess Club"
    url = f"/activities/{urllib.parse.quote(activity_name)}/signup?email={urllib.parse.quote(email)}"
    res = client.post(url)
    assert res.status_code == 400


def test_signup_full_fails():
    # Create a small activity and fill it
    activities["Tiny Club"] = {
        "description": "Tiny club",
        "schedule": "Now",
        "max_participants": 1,
        "participants": ["filled@mergington.edu"]
    }

    email = "late@mergington.edu"
    activity_name = "Tiny Club"
    url = f"/activities/{urllib.parse.quote(activity_name)}/signup?email={urllib.parse.quote(email)}"
    res = client.post(url)
    assert res.status_code == 400


def test_unregister_success():
    email = "willremove@mergington.edu"
    activity_name = "Chess Club"
    # First sign up
    signup_url = f"/activities/{urllib.parse.quote(activity_name)}/signup?email={urllib.parse.quote(email)}"
    res = client.post(signup_url)
    assert res.status_code == 200
    assert email in activities[activity_name]["participants"]

    # Now unregister
    delete_url = f"/activities/{urllib.parse.quote(activity_name)}/participants/{urllib.parse.quote(email)}"
    res = client.delete(delete_url)
    assert res.status_code == 200
    assert email not in activities[activity_name]["participants"]


def test_unregister_not_found():
    email = "notthere@mergington.edu"
    activity_name = "Chess Club"
    delete_url = f"/activities/{urllib.parse.quote(activity_name)}/participants/{urllib.parse.quote(email)}"
    res = client.delete(delete_url)
    assert res.status_code == 404
