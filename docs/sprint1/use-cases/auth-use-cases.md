# Authentication & Account Module - Use Cases
## Sprint 1 | EcoPlate

**Team:** Shared Responsibility (All Team)

---

## 1. Core Use Cases

### UC-AU-001: Register User
**Actor:** User  
**Description:** Create a new user account

**Preconditions:**
- User is not authenticated
- Email address is not already registered

**Main Flow:**
1. User navigates to registration screen
2. User enters:
   - Email address
   - Password (meeting strength requirements)
   - Full name
3. System validates email format
4. System validates password strength
5. System creates account
6. System sends verification email (optional for Sprint 1)
7. User is logged in automatically

**Validation Rules:**
- Email: Valid format, unique in system
- Password: Min 8 characters, 1 uppercase, 1 number

**Postconditions:**
- User account created
- User is authenticated

**Acceptance Criteria:**
- [ ] User registration validates email format and password strength

---

### UC-AU-002: Login User
**Actor:** User  
**Description:** Authenticate existing user

**Preconditions:**
- User has registered account
- User is not currently authenticated

**Main Flow:**
1. User navigates to login screen
2. User enters email and password
3. System validates credentials
4. System generates JWT access token and refresh token
5. System returns tokens to client
6. User is redirected to home screen

**Alternative Flow:**
- 3a. Invalid credentials: Display error message, remain on login screen

**Postconditions:**
- User is authenticated
- JWT tokens stored on client

**Acceptance Criteria:**
- [ ] JWT tokens expire after 1 hour; refresh tokens after 7 days

---

### UC-AU-003: Reset Password
**Actor:** User  
**Description:** Reset forgotten password via email

**Preconditions:**
- User has registered account
- User is not authenticated

**Main Flow:**
1. User clicks "Forgot Password"
2. User enters email address
3. System validates email exists
4. System generates reset token
5. System sends reset email with link
6. User clicks link in email
7. User enters new password
8. System updates password
9. User can login with new password

**Postconditions:**
- Password updated
- Reset token invalidated

**Acceptance Criteria:**
- [ ] Password reset emails sent within 30s

---

### UC-AU-004: Update User Profile
**Actor:** User  
**Description:** Modify user profile information

**Preconditions:**
- User is authenticated

**Main Flow:**
1. User navigates to Account Settings
2. User selects "Edit Profile"
3. User modifies:
   - Full name
   - Avatar image
   - Phone number
   - Location preferences
4. System validates inputs
5. System saves changes

**Postconditions:**
- Profile information updated

**Acceptance Criteria:**
- [ ] User profile updates reflect immediately

---

### UC-AU-005: Modify Notification Settings
**Actor:** User  
**Description:** Configure notification preferences

**Preconditions:**
- User is authenticated

**Main Flow:**
1. User navigates to Account Settings
2. User selects "Notifications"
3. User toggles:
   - Email notifications
   - Push notifications
4. System saves preferences

**Postconditions:**
- Notification preferences updated

---

## 2. Database Schema

```sql
-- Users table
CREATE TABLE users (
    id INT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    avatar_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    user_location VARCHAR(500)
);
```

---

## 3. API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Create new account |
| POST | `/api/v1/auth/login` | Authenticate user |
| POST | `/api/v1/auth/logout` | Invalidate session |
| POST | `/api/v1/auth/refresh` | Refresh JWT access token |
| POST | `/api/v1/auth/password-reset/request` | Request password reset |
| POST | `/api/v1/auth/password-reset/confirm` | Confirm password reset |
| GET | `/api/v1/account/profile` | Get user profile |
| PATCH | `/api/v1/account/profile` | Update user profile |
| PATCH | `/api/v1/account/settings/notifications` | Update notification preferences |

---

## 4. UI Prototypes

- Registration screen
- Login screen
- Password reset flow
- Account settings page

---

## 5. Security Considerations

- Passwords stored using bcrypt hashing
- JWT access tokens expire after 1 hour
- Refresh tokens expire after 7 days
- Password reset tokens expire after 24 hours
- Rate limiting on authentication endpoints
- HTTPS required for all auth endpoints

---

## 6. Acceptance Criteria Summary

- [ ] User registration validates email format and password strength
- [ ] JWT tokens expire after 1 hour; refresh tokens after 7 days
- [ ] Password reset emails sent within 30s
- [ ] User profile updates reflect immediately
