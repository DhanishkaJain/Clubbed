"""PyUnit tests for project structure and key application logic.

This module verifies that required root files exist and that the server
source contains the expected login and booking validation logic.
"""

import os
import re
import unittest

ROOT = os.path.dirname(os.path.abspath(__file__))
SERVER_PATH = os.path.join(ROOT, 'server.js')
DOCKERFILE_PATH = os.path.join(ROOT, 'Dockerfile')
PACKAGE_PATH = os.path.join(ROOT, 'package.json')


class TestAppStructure(unittest.TestCase):
    """Validate required repository files exist."""

    def test_dockerfile_exists(self):
        """Ensure Dockerfile is present in the repository root."""
        self.assertTrue(
            os.path.exists(DOCKERFILE_PATH),
            'Dockerfile should exist in the repository root'
        )

    def test_server_js_exists(self):
        """Ensure server.js is present in the repository root."""
        self.assertTrue(
            os.path.exists(SERVER_PATH),
            'server.js should exist in the repository root'
        )

    def test_package_json_exists(self):
        """Ensure package.json is present in the repository root."""
        self.assertTrue(
            os.path.exists(PACKAGE_PATH),
            'package.json should exist in the repository root'
        )


class TestAppLogic(unittest.TestCase):
    """Validate login and booking logic in server.js source."""

    @classmethod
    def setUpClass(cls):
        """Read server.js source once for pattern matching."""
        with open(SERVER_PATH, 'r', encoding='utf-8') as file:
            cls.source = file.read()

    def test_user_login_handles_empty_credentials(self):
        """Verify empty user login data rejects with the exact error message."""
        pattern = re.compile(
            (
                r"if\s*\(\s*!username\s*\|\|\s*!course\s*\|\|\s*!year\s*"
                r"\|\|\s*!password\s*\)\s*\{.*?return\s+res\.status\s*"
                r"\(\s*400\s*\)\.json\s*\(\s*\{[^}]*message\s*:\s*['\"]"
                r"All fields are required['\"]"
            ),
            re.S
        )
        self.assertRegex(
            self.source,
            pattern,
            'User login should reject empty credentials with 400 and exact message'
        )

    def test_user_login_handles_invalid_user(self):
        """Verify invalid user login rejects with 401 Invalid credentials."""
        pattern = re.compile(
            (
                r"const\s+user\s*=\s*await\s+User\.findOne\s*\(\s*\{[^}]*username\s*,"
                r"[^}]*course\s*,[^}]*year\s*,[^}]*role\s*:\s*['\"]user['\"]"
                r"[^}]*\}\s*\)\s*;.*?if\s*\(\s*!user\s*\)\s*\{.*?return\s+"
                r"res\.status\s*\(\s*401\s*\)\.json\s*\(\s*\{[^}]*message\s*:\s*['\"]"
                r"Invalid credentials['\"]"
            ),
            re.S
        )
        self.assertRegex(
            self.source,
            pattern,
            'User login should reject missing user with 401 Invalid credentials'
        )

    def test_user_login_handles_invalid_password(self):
        """Verify wrong password login rejects with 401 Invalid credentials."""
        pattern = re.compile(
            (
                r"const\s+passwordMatch\s*=\s*await\s+bcrypt\.compare\s*\(\s*password\s*"
                r"\s*,\s*user\.password\s*\)\s*;.*?if\s*\(\s*!passwordMatch\s*\)\s*\{.*?return\s+"
                r"res\.status\s*\(\s*401\s*\)\.json\s*\(\s*\{[^}]*message\s*:\s*['\"]"
                r"Invalid credentials['\"]"
            ),
            re.S
        )
        self.assertRegex(
            self.source,
            pattern,
            'User login should reject wrong password with 401 Invalid credentials'
        )

    def test_booking_rejects_existing_approved_or_pending_slot(self):
        """Verify booking route rejects slots already pending or approved."""
        pattern = re.compile(
            (
                r"const\s+existingOccupied\s*=\s*await\s+Booking\.findOne\s*\(\s*\{[^}]*venueId\s*"
                r"\:\s*venue\._id[^}]*bookingDate\s*\:\s*normalizedDate[^}]*timeSlotIndex"
                r"[^}]*status\s*\:\s*\{\s*\$in\s*\:\s*\[\s*['\"]pending['\"]\s*,\s*['\"]approved['\"]"
                r"\s*,\s*['\"]confirmed['\"]\s*\]\s*\}[^}]*\}\s*\)\s*;.*?if\s*\(\s*existingOccupied\s*\)\s*\{.*?return\s+"
                r"res\.status\s*\(\s*409\s*\)\.json\s*\(\s*\{[^}]*message\s*:\s*['\"]"
                r"This slot is already booked or waiting for approval['\"]"
            ),
            re.S
        )
        self.assertRegex(
            self.source,
            pattern,
            'Booking route should reject occupied slots with status pending/approved/confirmed and return 409'
        )


if __name__ == '__main__':
    unittest.main()
