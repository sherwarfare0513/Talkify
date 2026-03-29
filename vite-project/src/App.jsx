import { useEffect, useMemo, useState } from 'react'
import './App.css'

const SESSION_KEY = 'connectarena-session'
const DEV_SHORTCUT = 'Ctrl + Shift + D'
const moods = ['Building', 'Available', 'Focused', 'Gaming']

const emptyState = {
  currentUserId: null,
  users: [],
  friendRequests: [],
  messages: [],
  posts: [],
  gameRooms: [],
}

const policySections = {
  terms: {
    title: 'Terms of Use',
    body: [
      'Har user apni account security ka zimmedar hai aur respectful behavior follow karega.',
      'Harassment, spam, fake identity, ya abusive content allowed nahin hai.',
      'Game rooms aur chat sirf lawful aur friendly use ke liye hain.',
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    body: [
      'Is build me shared data backend par save hota hai taake multiple browsers same live state dekh saken.',
      'Public dashboard par total users aur total online users jaisi internal analytics nahin dikhayi jati.',
      'Developer-only diagnostics hidden mode me available hain taake normal users ko internal stats nazar na aayen.',
    ],
  },
}

function isStrongPassword(value) {
  return /^(?=.{8,}$)[A-Z](?=.*\d)(?=.*[^A-Za-z0-9]).*$/.test(value)
}

function isValidUsername(value) {
  return /^[a-z][a-z0-9._]{2,19}$/.test(value)
}

function isValidName(value) {
  return /^[A-Za-z][A-Za-z\s'-]{1,29}$/.test(value.trim())
}

function isValidPhone(value) {
  return /^\+?[0-9]{10,15}$/.test(value.trim())
}

function isAdultDob(value) {
  if (!value) return false
  const dob = new Date(value)
  if (Number.isNaN(dob.getTime())) return false

  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const monthDiff = today.getMonth() - dob.getMonth()

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1
  }

  return age >= 18
}

function ValidationItem({ ok, text }) {
  return <span className={`validation-item ${ok ? 'ok' : ''}`}>{text}</span>
}

const fieldRequirements = {
  email: ['Valid email format (e.g., user@example.com)'],
  phone: ['Valid phone number (10-15 digits, optional + at start)'],
  dob: ['Must be at least 18 years old'],
  gender: ['Select a gender'],
  password: ['At least 8 characters', 'Starts with uppercase letter', 'Contains a number', 'Contains a special character'],
  firstName: ['Starts with letter, only letters, spaces, apostrophe, hyphen'],
  lastName: ['Starts with letter, only letters, spaces, apostrophe, hyphen'],
  username: ['Starts with lowercase letter', '3-20 characters', 'Only letters, numbers, dot, underscore'],
}

function App() {
  const [appState, setAppState] = useState(emptyState)
  const [sessionUserId, setSessionUserId] = useState(() => localStorage.getItem(SESSION_KEY) || '')
  const [authMode, setAuthMode] = useState('signup')
  const [signupStep, setSignupStep] = useState(1)
  const [authForm, setAuthForm] = useState({
    firstName: '',
    lastName: '',
    username: '',
    password: '',
    email: '',
    phone: '',
    dob: '',
    gender: '',
    bio: '',
    city: '',
    agreed: false,
  })
  const [authTouched, setAuthTouched] = useState({
    firstName: false,
    lastName: false,
    username: false,
    password: false,
    email: false,
    phone: false,
    dob: false,
    gender: false,
  })
  const [authError, setAuthError] = useState('')
  const [policyView, setPolicyView] = useState('')
  const [postText, setPostText] = useState('')
  const [selectedMood, setSelectedMood] = useState(moods[0])
  const [selectedFriendId, setSelectedFriendId] = useState('')
  const [chatDraft, setChatDraft] = useState('')
  const [newRoom, setNewRoom] = useState({ friendId: '', type: 'tic' })
  const [devMode, setDevMode] = useState(false)
  const [loading, setLoading] = useState(true)
  const [focusedField, setFocusedField] = useState(null)
  const [fieldValid, setFieldValid] = useState({
    firstName: false,
    lastName: false,
    username: false,
    password: false,
    email: false,
    phone: false,
    dob: false,
    gender: false,
  })

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'd') {
        event.preventDefault()
        setDevMode((current) => !current)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    let active = true

    const loadState = async () => {
      try {
        const response = await fetch('https://talkify-backend-lyart.vercel.app/state');
        const data = await response.json()
        if (!active) return
        setAppState(normalizeState({ ...data, currentUserId: sessionUserId || null }))
      } catch {
        if (!active) return
        setAuthError('Server se connection nahin ban raha. Pehle backend start karein.')
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadState()
    const timer = window.setInterval(loadState, 2500)

    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [sessionUserId])

  const currentUser = appState.users.find((user) => user.id === sessionUserId) ?? null

  const acceptedFriendIds = useMemo(() => {
    if (!currentUser) return []
    return appState.friendRequests
      .filter(
        (request) =>
          request.status === 'accepted' &&
          (request.from === currentUser.id || request.to === currentUser.id),
      )
      .map((request) => (request.from === currentUser.id ? request.to : request.from))
  }, [appState.friendRequests, currentUser])

  const friends = useMemo(
    () => appState.users.filter((user) => acceptedFriendIds.includes(user.id)),
    [acceptedFriendIds, appState.users],
  )

  const discoverUsers = useMemo(() => {
    if (!currentUser) return []
    return appState.users
      .filter((user) => user.id !== currentUser.id)
      .sort((a, b) => Number(b.online) - Number(a.online))
  }, [appState.users, currentUser])

  const incomingRequests = useMemo(() => {
    if (!currentUser) return []
    return appState.friendRequests.filter(
      (request) => request.to === currentUser.id && request.status === 'pending',
    )
  }, [appState.friendRequests, currentUser])

  const sentRequests = useMemo(() => {
    if (!currentUser) return []
    return appState.friendRequests.filter(
      (request) => request.from === currentUser.id && request.status === 'pending',
    )
  }, [appState.friendRequests, currentUser])

  const chatThreads = useMemo(() => {
    if (!currentUser) return []
    return friends.map((friend) => {
      const messages = appState.messages
        .filter(
          (message) =>
            (message.from === currentUser.id && message.to === friend.id) ||
            (message.from === friend.id && message.to === currentUser.id),
        )
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))

      return {
        friend,
        messages,
        lastMessage: messages[messages.length - 1] ?? null,
      }
    })
  }, [appState.messages, currentUser, friends])

  const activeFriendId =
    selectedFriendId && friends.some((friend) => friend.id === selectedFriendId)
      ? selectedFriendId
      : friends[0]?.id || ''
  const activeThread = chatThreads.find((thread) => thread.friend.id === activeFriendId) ?? null

  const visibleRooms = useMemo(() => {
    if (!currentUser) return []
    return appState.gameRooms
      .filter((room) => room.hostId === currentUser.id || room.guestId === currentUser.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }, [appState.gameRooms, currentUser])

  const developerStats = useMemo(
    () => ({
      totalUsers: appState.users.length,
      onlineUsers: appState.users.filter((user) => user.online).length,
      posts: appState.posts.length,
      rooms: appState.gameRooms.length,
      pendingRequests: appState.friendRequests.filter((request) => request.status === 'pending').length,
    }),
    [appState],
  )

  const getUser = (userId) => appState.users.find((user) => user.id === userId)

  const syncFromResponse = (data) => {
    const nextUserId = data?.userId ?? sessionUserId ?? null
    if (data?.state) {
      setAppState(normalizeState({ ...data.state, currentUserId: nextUserId }))
    }
    if (data?.userId) {
      setSessionUserId(data.userId)
      localStorage.setItem(SESSION_KEY, data.userId)
    }
  }

  const postApi = async (path, body) => {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || 'Request failed.')
    }
    syncFromResponse(data)
    return data
  }

  const handleAuthChange = (event) => {
    const { name, value, type, checked } = event.target
    setAuthForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }))
    if (name in authTouched) {
      setAuthTouched((current) => ({
        ...current,
        [name]: true,
      }))
    }
    // Update fieldValid
    if (name === 'email') {
      setFieldValid((prev) => ({ ...prev, email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) }))
    } else if (name === 'phone') {
      setFieldValid((prev) => ({ ...prev, phone: isValidPhone(value) }))
    } else if (name === 'dob') {
      setFieldValid((prev) => ({ ...prev, dob: isAdultDob(value) }))
    } else if (name === 'gender') {
      setFieldValid((prev) => ({ ...prev, gender: Boolean(value) }))
    } else if (name === 'password') {
      setFieldValid((prev) => ({ ...prev, password: isStrongPassword(value) }))
    } else if (name === 'firstName') {
      setFieldValid((prev) => ({ ...prev, firstName: isValidName(value) }))
    } else if (name === 'lastName') {
      setFieldValid((prev) => ({ ...prev, lastName: isValidName(value) }))
    } else if (name === 'username') {
      setFieldValid((prev) => ({ ...prev, username: isValidUsername(value.trim().toLowerCase()) }))
    }
  }

  const handleAuthBlur = (event) => {
    const { name } = event.target
    if (name in authTouched) {
      setAuthTouched((current) => ({
        ...current,
        [name]: true,
      }))
    }
  }

  const resetAuthForm = () => {
    setAuthForm({
      firstName: '',
      lastName: '',
      username: '',
      password: '',
      email: '',
      phone: '',
      dob: '',
      gender: '',
      bio: '',
      city: '',
      agreed: false,
    })
    setAuthTouched({
      firstName: false,
      lastName: false,
      username: false,
      password: false,
      email: false,
      phone: false,
      dob: false,
      gender: false,
    })
    setSignupStep(1)
    setFocusedField(null)
    setFieldValid({
      firstName: false,
      lastName: false,
      username: false,
      password: false,
      email: false,
      phone: false,
      dob: false,
      gender: false,
    })
  }

  const goToSignupStepTwo = () => {
    const email = authForm.email.trim().toLowerCase()
    const phone = authForm.phone.trim()
    const password = authForm.password.trim()
    const dob = authForm.dob
    const gender = authForm.gender.trim()

    if (!email || !phone || !password || !dob || !gender) {
      setAuthError('Email, phone, date of birth, gender, aur password required hain.')
      return
    }
    if (!isValidPhone(phone)) {
      setAuthError('Phone number valid format mein hona chahiye.')
      return
    }
    if (!isAdultDob(dob)) {
      setAuthError('Sirf 18 saal ya us se zyada age wale users signup kar sakte hain.')
      return
    }
    if (!isStrongPassword(password)) {
      setAuthError(
        'Password kam az kam 8 characters ka ho, pehla letter uppercase ho, aur usme number aur special character bhi ho.',
      )
      return
    }

    setAuthError('')
    setSignupStep(2)
  }

  const submitSignup = async () => {
    const cleanUsername = authForm.username.trim().toLowerCase()
    const email = authForm.email.trim().toLowerCase()
    const phone = authForm.phone.trim()
    const firstName = authForm.firstName.trim()
    const lastName = authForm.lastName.trim()
    const dob = authForm.dob
    const gender = authForm.gender.trim()

    if (!firstName || !lastName || !cleanUsername || !authForm.password.trim() || !email || !phone || !dob || !gender) {
      setAuthError('First name, last name, username, email, phone, date of birth, gender, aur password required hain.')
      return
    }
    if (!isValidName(firstName) || !isValidName(lastName)) {
      setAuthError('First name aur last name mein sirf valid letters hone chahiye.')
      return
    }
    if (!isValidUsername(cleanUsername)) {
      setAuthError('Username lowercase ho aur sirf letters, numbers, dot, ya underscore use kare.')
      return
    }
    if (!isStrongPassword(authForm.password.trim())) {
      setAuthError(
        'Password kam az kam 8 characters ka ho, pehla letter uppercase ho, aur usme number aur special character bhi ho.',
      )
      return
    }
    if (!isValidPhone(phone)) {
      setAuthError('Phone number valid format mein hona chahiye.')
      return
    }
    if (!isAdultDob(dob)) {
      setAuthError('Sirf 18 saal ya us se zyada age wale users signup kar sakte hain.')
      return
    }

    if (!authForm.agreed) {
      setAuthError('Account banane se pehle Terms aur Privacy se agree karna zaroori hai.')
      return
    }

    try {
      await postApi('/api/auth/signup', {
        firstName,
        lastName,
        username: cleanUsername,
        password: authForm.password,
        email,
        phone,
        dob,
        gender,
        bio: authForm.bio,
        city: authForm.city,
        agreed: authForm.agreed,
      })
      setAuthError('')
      resetAuthForm()
    } catch (error) {
      setAuthError(error.message)
    }
  }

  const handleSignup = async (event) => {
    event.preventDefault()

    if (signupStep === 1) {
      goToSignupStepTwo()
      return
    }

    await submitSignup()
  }

  const handleLogin = async (event) => {
    event.preventDefault()
    const phone = authForm.phone.trim()

    if (!phone || !authForm.password.trim()) {
      setAuthError('Phone number aur password required hain.')
      return
    }

    try {
      await postApi('/api/auth/login', {
        phone,
        password: authForm.password,
      })
      setAuthError('')
      resetAuthForm()
    } catch (error) {
      setAuthError(error.message)
    }
  }

  const logout = async () => {
    if (!currentUser) return
    try {
      await postApi('/api/logout', { userId: currentUser.id })
    } finally {
      setSessionUserId('')
      localStorage.removeItem(SESSION_KEY)
      setAppState((current) => ({ ...current, currentUserId: null }))
    }
  }

  const togglePresence = async () => {
    if (!currentUser) return
    await postApi('/api/presence', { userId: currentUser.id })
  }

  const sendFriendRequest = async (targetId) => {
    if (!currentUser) return
    const existing = appState.friendRequests.some(
      (request) =>
        ((request.from === currentUser.id && request.to === targetId) ||
          (request.from === targetId && request.to === currentUser.id)) &&
        ['pending', 'accepted'].includes(request.status),
    )
    if (existing) return
    await postApi('/api/friend-request', { from: currentUser.id, to: targetId })
  }

  const answerRequest = async (requestId, status) => {
    await postApi('/api/friend-request/respond', { requestId, status })
  }

  const createPost = async (event) => {
    event.preventDefault()
    if (!currentUser || !postText.trim()) return
    await postApi('/api/post', {
      authorId: currentUser.id,
      mood: selectedMood,
      content: postText.trim(),
    })
    setPostText('')
  }

  const sendMessage = async (event) => {
    event.preventDefault()
    if (!currentUser || !activeFriendId || !chatDraft.trim()) return
    await postApi('/api/message', {
      from: currentUser.id,
      to: activeFriendId,
      text: chatDraft.trim(),
    })
    setChatDraft('')
  }

  const createRoom = async (event) => {
    event.preventDefault()
    if (!currentUser || !newRoom.friendId) return
    await postApi('/api/game-room', {
      hostId: currentUser.id,
      guestId: newRoom.friendId,
      type: newRoom.type,
    })
    setNewRoom({ friendId: '', type: 'tic' })
  }

  const playTicCell = async (roomId, index) => {
    if (!currentUser) return
    await postApi('/api/game-room/tic', { roomId, userId: currentUser.id, index })
  }

  const playRpsRound = async (roomId, move) => {
    if (!currentUser) return
    await postApi('/api/game-room/rps', { roomId, userId: currentUser.id, move })
  }

  const passwordChecks = {
    length: authForm.password.length >= 8,
    firstUpper: /^[A-Z]/.test(authForm.password),
    hasNumber: /\d/.test(authForm.password),
    hasSpecial: /[^A-Za-z0-9]/.test(authForm.password),
  }

  if (loading) {
    return (
      <main className="auth-shell">
        <section className="auth-hero">
          <p className="eyebrow">ConnectArena</p>
          <h1>Connecting to live server...</h1>
          <p className="hero-copy">Backend state load ho rahi hai. Agar yeh screen ruk jaye to `npm run dev` dobara start karein.</p>
        </section>
      </main>
    )
  }

  if (!currentUser) {
    return (
      <>
        <main className="auth-shell">
          <section className="auth-hero">
            <p className="eyebrow">ConnectArena</p>
            <h1>Private social platform with polished chat, game rooms, and secure onboarding.</h1>
            <p className="hero-copy">
              Professional signup flow, mandatory terms consent, cleaner privacy boundaries, and
              multiplayer interactions built into one modern interface.
            </p>
            <div className="feature-grid">
              <article>
                <strong>Private by default</strong>
                <span>Internal user totals normal members ko visible nahin hain.</span>
              </article>
              <article>
                <strong>Social workflow</strong>
                <span>Signup, requests, chat, posting, and direct game rooms.</span>
              </article>
              <article>
                <strong>Modern UX</strong>
                <span>Refined layout, cleaner forms, aur better game presentation.</span>
              </article>
            </div>
          </section>

          <section className="auth-card">
            <div className="mode-switch">
              <button
                type="button"
                className={authMode === 'signup' ? 'active' : ''}
                onClick={() => {
                  setAuthMode('signup')
                  setAuthError('')
                  setSignupStep(1)
                }}
              >
                Sign up
              </button>
              <button
                type="button"
                className={authMode === 'login' ? 'active' : ''}
                onClick={() => {
                  setAuthMode('login')
                  setAuthError('')
                  setSignupStep(1)
                }}
              >
                Log in
              </button>
            </div>

            <form onSubmit={authMode === 'signup' ? handleSignup : handleLogin} className="auth-form">
              {authMode === 'signup' ? (
                <>
                  <div className="signup-steps">
                    <span className={signupStep === 1 ? 'active' : ''}>Step 1: Contact</span>
                    <span className={signupStep === 2 ? 'active' : ''}>Step 2: Profile</span>
                  </div>
                  {signupStep === 1 ? (
                    <>
                      <label>
                        Email {fieldValid.email && <span className="field-tick">✓</span>}
                        <input
                          name="email"
                          type="email"
                          value={authForm.email}
                          onChange={handleAuthChange}
                          onBlur={() => setFocusedField(null)}
                          onFocus={() => setFocusedField('email')}
                          placeholder="example@email.com"
                        />
                      </label>
                      {focusedField === 'email' && !fieldValid.email && (
                        <div className="field-requirements">
                          {fieldRequirements.email.map((req) => (
                            <div key={req} className="requirement-item">
                              {req}
                            </div>
                          ))}
                        </div>
                      )}

                      <label>
                        Phone number {fieldValid.phone && <span className="field-tick">✓</span>}
                        <input
                          name="phone"
                          type="tel"
                          value={authForm.phone}
                          onChange={handleAuthChange}
                          onBlur={() => setFocusedField(null)}
                          onFocus={() => setFocusedField('phone')}
                          placeholder="+923001234567"
                        />
                      </label>
                      {focusedField === 'phone' && !fieldValid.phone && (
                        <div className="field-requirements">
                          {fieldRequirements.phone.map((req) => (
                            <div key={req} className="requirement-item">
                              {req}
                            </div>
                          ))}
                        </div>
                      )}
                      <label>
                        Date of birth {fieldValid.dob && <span className="field-tick">✓</span>}
                        <input
                          name="dob"
                          type="date"
                          value={authForm.dob}
                          onChange={handleAuthChange}
                          onBlur={() => setFocusedField(null)}
                          onFocus={() => setFocusedField('dob')}
                        />
                      </label>
                      {focusedField === 'dob' && !fieldValid.dob && (
                        <div className="field-requirements">
                          {fieldRequirements.dob.map((req) => (
                            <div key={req} className="requirement-item">
                              {req}
                            </div>
                          ))}
                        </div>
                      )}
                      <label>
                        Gender {fieldValid.gender && <span className="field-tick">✓</span>}
                        <select
                          name="gender"
                          value={authForm.gender}
                          onChange={handleAuthChange}
                          onBlur={() => setFocusedField(null)}
                          onFocus={() => setFocusedField('gender')}
                        >
                          <option value="">Select gender</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="non-binary">Non-binary</option>
                        </select>
                      </label>
                      {focusedField === 'gender' && !fieldValid.gender && (
                        <div className="field-requirements">
                          {fieldRequirements.gender.map((req) => (
                            <div key={req} className="requirement-item">
                              {req}
                            </div>
                          ))}
                        </div>
                      )}

                      <label>
                        Password {fieldValid.password && <span className="field-tick">✓</span>}
                        <input
                          name="password"
                          type="password"
                          value={authForm.password}
                          onChange={handleAuthChange}
                          onBlur={() => setFocusedField(null)}
                          onFocus={() => setFocusedField('password')}
                        />
                      </label>
                      {focusedField === 'password' && !fieldValid.password && (
                        <div className="field-requirements">
                          {fieldRequirements.password.map((req, index) => {
                            let ok = false
                            if (index === 0) ok = authForm.password.length >= 8
                            else if (index === 1) ok = /^[A-Z]/.test(authForm.password)
                            else if (index === 2) ok = /\d/.test(authForm.password)
                            else if (index === 3) ok = /[^A-Za-z0-9]/.test(authForm.password)
                            return (
                              <div key={req} className={`requirement-item ${ok ? 'ok' : ''}`}>
                                {ok && '✓'} {req}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <label>
                        First name {fieldValid.firstName && <span className="field-tick">✓</span>}
                        <input
                          name="firstName"
                          value={authForm.firstName}
                          onChange={handleAuthChange}
                          onBlur={() => setFocusedField(null)}
                          onFocus={() => setFocusedField('firstName')}
                        />
                      </label>
                      {focusedField === 'firstName' && !fieldValid.firstName && (
                        <div className="field-requirements">
                          {fieldRequirements.firstName.map((req) => (
                            <div key={req} className="requirement-item">
                              {req}
                            </div>
                          ))}
                        </div>
                      )}
                      <label>
                        Last name {fieldValid.lastName && <span className="field-tick">✓</span>}
                        <input
                          name="lastName"
                          value={authForm.lastName}
                          onChange={handleAuthChange}
                          onBlur={() => setFocusedField(null)}
                          onFocus={() => setFocusedField('lastName')}
                        />
                      </label>
                      {focusedField === 'lastName' && !fieldValid.lastName && (
                        <div className="field-requirements">
                          {fieldRequirements.lastName.map((req) => (
                            <div key={req} className="requirement-item">
                              {req}
                            </div>
                          ))}
                        </div>
                      )}
                      <label>
                        Username {fieldValid.username && <span className="field-tick">✓</span>}
                        <input
                          name="username"
                          value={authForm.username}
                          onChange={handleAuthChange}
                          onBlur={() => setFocusedField(null)}
                          onFocus={() => setFocusedField('username')}
                        />
                      </label>
                      {focusedField === 'username' && !fieldValid.username && (
                        <div className="field-requirements">
                          {fieldRequirements.username.map((req, index) => {
                            let ok = false
                            const val = authForm.username.trim().toLowerCase()
                            if (index === 0) ok = /^[a-z]/.test(val)
                            else if (index === 1) ok = val.length >= 3 && val.length <= 20
                            else if (index === 2) ok = /^[a-z0-9._]+$/.test(val)
                            return (
                              <div key={req} className={`requirement-item ${ok ? 'ok' : ''}`}>
                                {ok && '✓'} {req}
                              </div>
                            )
                          })}
                        </div>
                      )}
                      <p className="field-hint">
                        Username lowercase ho aur 3-20 characters ka ho. Sirf letters, numbers,
                        dot `.` aur underscore `_` use kare.
                      </p>
                      <label>
                        City
                        <input name="city" value={authForm.city} onChange={handleAuthChange} />
                      </label>
                      <label>
                        Bio
                        <textarea name="bio" rows="4" value={authForm.bio} onChange={handleAuthChange} />
                      </label>
                    </>
                  )}
                </>
              ) : null}

              {authMode === 'login' ? (
                <>
                  <label>
                    Phone number
                    <input
                      name="phone"
                      type="tel"
                      value={authForm.phone}
                      onChange={handleAuthChange}
                      placeholder="+923001234567"
                    />
                  </label>

                  <label>
                    Password
                    <input
                      name="password"
                      type="password"
                      value={authForm.password}
                      onChange={handleAuthChange}
                    />
                  </label>
                </>
              ) : null}

              {authMode === 'signup' ? (
                <label className="checkbox-line">
                  <input
                    name="agreed"
                    type="checkbox"
                    checked={authForm.agreed}
                    onChange={handleAuthChange}
                  />
                  <span>I agree to the Terms of Use and Privacy Policy.</span>
                </label>
              ) : null}

              <div className="policy-actions">
                <button type="button" className="link-button" onClick={() => setPolicyView('terms')}>
                  View Terms
                </button>
                <button type="button" className="link-button" onClick={() => setPolicyView('privacy')}>
                  View Privacy Policy
                </button>
              </div>

              {authError ? <p className="form-error">{authError}</p> : null}

              {authMode === 'signup' ? (
                <div className="form-actions">
                  {signupStep === 2 ? (
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => {
                        setSignupStep(1)
                        setAuthError('')
                      }}
                    >
                      Back
                    </button>
                  ) : null}
                  <button
                    className="primary-button"
                    type={signupStep === 1 ? 'button' : 'submit'}
                    onClick={signupStep === 1 ? goToSignupStepTwo : undefined}
                  >
                    {signupStep === 1 ? 'Next step' : 'Create account'}
                  </button>
                </div>
              ) : (
                <button className="primary-button" type="submit">
                  Log in
                </button>
              )}
            </form>
          </section>
        </main>

        {policyView ? (
          <PolicyModal section={policySections[policyView]} onClose={() => setPolicyView('')} />
        ) : null}
      </>
    )
  }

  return (
    <main className="app-shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">ConnectArena</p>
          <h2>{currentUser.name}</h2>
          <p className="muted">
            @{currentUser.username} | {currentUser.city}
          </p>
          <p className="status-line">
            <span className={`presence-dot ${currentUser.online ? 'online' : ''}`}></span>
            {currentUser.online ? 'Visible to friends' : 'Hidden from active lists'}
          </p>
        </div>

        <div className="topbar-actions">
          <button className="ghost-button" onClick={togglePresence}>
            {currentUser.online ? 'Set invisible' : 'Go online'}
          </button>
          <button className="primary-button" onClick={logout}>
            Logout
          </button>
        </div>
      </section>

      <section className="layout-grid">
        <aside className="stack">
          <article className="panel profile-panel">
            <div className="panel-header">
              <h3>Profile</h3>
              <p>Your public presence for network and games.</p>
            </div>
            <strong>{currentUser.name}</strong>
            <p className="muted">@{currentUser.username}</p>
            <p>{currentUser.bio}</p>
          </article>

          <article className="panel">
            <div className="panel-header">
              <h3>Requests</h3>
              <p>Incoming and outgoing connection requests.</p>
            </div>
            <div className="request-block">
              <strong>Incoming</strong>
              {incomingRequests.length ? (
                incomingRequests.map((request) => (
                  <div className="request-row" key={request.id}>
                    <span>{getUser(request.from)?.name}</span>
                    <div className="action-group">
                      <button className="tiny-button accept" onClick={() => answerRequest(request.id, 'accepted')}>
                        Accept
                      </button>
                      <button className="tiny-button" onClick={() => answerRequest(request.id, 'rejected')}>
                        Decline
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="empty-state">No pending incoming requests.</p>
              )}
            </div>
            <div className="request-block">
              <strong>Sent</strong>
              {sentRequests.length ? (
                sentRequests.map((request) => (
                  <p key={request.id}>{getUser(request.to)?.name} is waiting to respond.</p>
                ))
              ) : (
                <p className="empty-state">No outgoing pending requests.</p>
              )}
            </div>
          </article>
        </aside>

        <section className="stack">
          <article className="panel composer">
            <div className="panel-header">
              <h3>Publish update</h3>
              <p>Share status, invite friends, or announce a new match.</p>
            </div>
            <form onSubmit={createPost}>
              <div className="composer-row">
                <select value={selectedMood} onChange={(event) => setSelectedMood(event.target.value)}>
                  {moods.map((mood) => (
                    <option key={mood} value={mood}>
                      {mood}
                    </option>
                  ))}
                </select>
                <textarea
                  rows="4"
                  placeholder="Write something polished for your network."
                  value={postText}
                  onChange={(event) => setPostText(event.target.value)}
                />
              </div>
              <button className="primary-button" type="submit">
                Post update
              </button>
            </form>
          </article>

          <article className="panel">
            <div className="panel-header">
              <h3>Network feed</h3>
              <p>Latest updates from all registered members.</p>
            </div>
            <div className="feed-list">
              {appState.posts.length ? (
                appState.posts.map((post) => (
                  <article className="post-card" key={post.id}>
                    <div className="post-top">
                      <div>
                        <strong>{getUser(post.authorId)?.name}</strong>
                        <p>
                          @{getUser(post.authorId)?.username} | {formatDate(post.createdAt)}
                        </p>
                      </div>
                      <span className="pill">{post.mood}</span>
                    </div>
                    <p>{post.content}</p>
                  </article>
                ))
              ) : (
                <p className="empty-state">No posts yet. Publish the first update.</p>
              )}
            </div>
          </article>
        </section>
        <aside className="stack">
          <article className="panel">
            <div className="panel-header">
              <h3>People</h3>
              <p>Send requests without exposing internal platform totals.</p>
            </div>
            <div className="discover-list">
              {discoverUsers.length ? (
                discoverUsers.map((user) => {
                  const requestState = getRelationshipState(appState.friendRequests, currentUser.id, user.id)
                  return (
                    <article className="discover-card" key={user.id}>
                      <div>
                        <strong>{user.name}</strong>
                        <p>{user.city}</p>
                        <span>{user.bio}</span>
                      </div>
                      <div className="discover-actions">
                        <span className={`mini-status ${user.online ? 'online' : ''}`}>
                          {user.online ? 'Online' : 'Offline'}
                        </span>
                        <button
                          className="small-button"
                          onClick={() => sendFriendRequest(user.id)}
                          disabled={requestState !== 'none'}
                        >
                          {requestState === 'friends'
                            ? 'Connected'
                            : requestState === 'sent'
                              ? 'Pending'
                              : requestState === 'received'
                                ? 'Check requests'
                                : 'Connect'}
                        </button>
                      </div>
                    </article>
                  )
                })
              ) : (
                <p className="empty-state">No other users yet. Create another account to connect.</p>
              )}
            </div>
          </article>
        </aside>
      </section>

      <section className="lower-grid">
        <article className="panel chat-panel">
          <div className="panel-header">
            <h3>Secure chat</h3>
            <p>Conversation panel only opens after a request is accepted.</p>
          </div>

          {friends.length ? (
            <div className="chat-layout">
              <div className="chat-sidebar">
                {friends.map((friend) => {
                  const thread = chatThreads.find((item) => item.friend.id === friend.id)
                  return (
                    <button
                      key={friend.id}
                      className={`chat-friend ${activeFriendId === friend.id ? 'selected' : ''}`}
                      onClick={() => setSelectedFriendId(friend.id)}
                    >
                      <strong>{friend.name}</strong>
                      <span>{thread?.lastMessage?.text ?? 'No messages yet'}</span>
                    </button>
                  )
                })}
              </div>

              <div className="chat-thread">
                <div className="thread-header">
                  <strong>{activeThread?.friend.name}</strong>
                  <span>{activeThread?.friend.online ? 'Available now' : 'Currently away'}</span>
                </div>
                <div className="messages">
                  {activeThread?.messages.length ? (
                    activeThread.messages.map((message) => (
                      <div
                        className={`message-bubble ${message.from === currentUser.id ? 'own' : ''}`}
                        key={message.id}
                      >
                        <p>{message.text}</p>
                        <span>{formatTime(message.createdAt)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="empty-state">Start the conversation.</p>
                  )}
                </div>
                <form className="chat-form" onSubmit={sendMessage}>
                  <input
                    value={chatDraft}
                    onChange={(event) => setChatDraft(event.target.value)}
                    placeholder="Write a direct message"
                  />
                  <button className="primary-button" type="submit">
                    Send
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <p className="empty-state">Chat becomes available once two users are connected.</p>
          )}
        </article>
        <article className="panel games-panel">
          <div className="panel-header">
            <h3>Game lounge</h3>
            <p>Invite a connected friend into a proper multiplayer room.</p>
          </div>

          <form className="game-create" onSubmit={createRoom}>
            <select
              value={newRoom.friendId}
              onChange={(event) => setNewRoom((current) => ({ ...current, friendId: event.target.value }))}
            >
              <option value="">Choose friend</option>
              {friends.map((friend) => (
                <option key={friend.id} value={friend.id}>
                  {friend.name}
                </option>
              ))}
            </select>
            <select
              value={newRoom.type}
              onChange={(event) => setNewRoom((current) => ({ ...current, type: event.target.value }))}
            >
              <option value="tic">Tic Tac Toe</option>
              <option value="rps">Rock Paper Scissors</option>
            </select>
            <button className="primary-button" type="submit">
              Create room
            </button>
          </form>

          <div className="rooms-list">
            {visibleRooms.length ? (
              visibleRooms.map((room) => {
                const opponent = getUser(room.hostId === currentUser.id ? room.guestId : room.hostId)
                const isMyTurn = room.turn === currentUser.id
                return (
                  <article className="room-card" key={room.id}>
                    <div className="room-head">
                      <div>
                        <strong>
                          {room.type === 'tic' ? 'Tic Tac Toe' : 'Rock Paper Scissors'} vs {opponent?.name}
                        </strong>
                        <p>{room.resultLabel || (isMyTurn ? 'Your move.' : 'Waiting for opponent.')}</p>
                      </div>
                      <span className="pill">{room.status}</span>
                    </div>

                    {room.type === 'tic' ? (
                      <div className="tic-board">
                        {room.board.map((cell, index) => (
                          <button
                            key={`${room.id}-${index}`}
                            className="tic-cell"
                            onClick={() => playTicCell(room.id, index)}
                            disabled={room.status !== 'active' || !isMyTurn || Boolean(cell)}
                          >
                            {cell === room.hostId ? 'X' : cell === room.guestId ? 'O' : ''}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="rps-panel">
                        <div className="rps-actions">
                          {['rock', 'paper', 'scissors'].map((move) => (
                            <button
                              key={`${room.id}-${move}`}
                              type="button"
                              className="small-button"
                              disabled={room.status !== 'active'}
                              onClick={() => playRpsRound(room.id, move)}
                            >
                              {move}
                            </button>
                          ))}
                        </div>
                        <div className="guess-history">
                          {room.rounds.length ? (
                            room.rounds.map((round) => (
                              <p key={round.id}>
                                X: {round.hostMove} | O: {round.guestMove} |{' '}
                                {round.winnerId ? `${getUser(round.winnerId)?.name} won` : 'Tie'}
                              </p>
                            ))
                          ) : (
                            <p className="empty-state">No completed round yet.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </article>
                )
              })
            ) : (
              <p className="empty-state">Create a room to start playing with a friend.</p>
            )}
          </div>
        </article>
      </section>

      {devMode ? (
        <section className="dev-panel">
          <strong>Developer diagnostics</strong>
          <span>Total users: {developerStats.totalUsers}</span>
          <span>Online users: {developerStats.onlineUsers}</span>
          <span>Posts: {developerStats.posts}</span>
          <span>Rooms: {developerStats.rooms}</span>
          <span>Pending requests: {developerStats.pendingRequests}</span>
          <span>Toggle: {DEV_SHORTCUT}</span>
        </section>
      ) : null}
    </main>
  )
}

function PolicyModal({ section, onClose }) {
  return (
    <div className="policy-modal">
      <div className="policy-card">
        <div className="panel-header">
          <h3>{section.title}</h3>
          <p>Read before creating a new account.</p>
        </div>
        <div className="policy-copy">
          {section.body.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
        <button className="primary-button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}

function normalizeState(state) {
  return {
    currentUserId: state?.currentUserId ?? null,
    users: Array.isArray(state?.users) ? state.users : [],
    friendRequests: Array.isArray(state?.friendRequests) ? state.friendRequests : [],
    messages: Array.isArray(state?.messages) ? state.messages : [],
    posts: Array.isArray(state?.posts) ? state.posts : [],
    gameRooms: Array.isArray(state?.gameRooms) ? state.gameRooms : [],
  }
}

function getRelationshipState(requests, currentUserId, otherUserId) {
  const request = requests.find(
    (item) =>
      (item.from === currentUserId && item.to === otherUserId) ||
      (item.from === otherUserId && item.to === currentUserId),
  )
  if (!request) return 'none'
  if (request.status === 'accepted') return 'friends'
  if (request.from === currentUserId) return 'sent'
  return 'received'
}

function formatDate(value) {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default App
