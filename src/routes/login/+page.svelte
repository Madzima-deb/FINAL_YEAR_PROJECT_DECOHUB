 // Errors
    let errors    = $state<Record<string, string>>({});
    let formError = $state('');

    // ── Social error messages from URL ────────────────────────────────────────
    const SOCIAL_ERRORS: Record<string, string> = {
        google_not_configured: 'Google login is not configured yet. Please use email/password.',
        apple_not_configured:  'Apple Sign-In is not configured yet. Please use email/password.',
        invalid_state:         'Authentication was interrupted. Please try again.',
        google_oauth_error:    'Google sign-in failed. Please try again.',
        apple_oauth_error:     'Apple sign-in failed. Please try again.',
        apple_token_invalid:   'Could not verify your Apple credentials. Please try again.',
        token_exchange_failed: 'Could not complete sign-in. Please try again.',
        profile_fetch_failed:  'Could not retrieve your profile. Please try again.',
        email_not_verified:    'Your email address is not verified.',
        account_exists:        'An account with this email already exists using a different sign-in method. Please use that method to log in.',
        server_error:          'An unexpected error occurred. Please try again.',
        missing_code:          'Authentication response was incomplete. Please try again.',
    };

    onMount(() => {
        const errorParam = $page.url.searchParams.get('error');
        if (errorParam && SOCIAL_ERRORS[errorParam]) {
            openModal('login');
            // Set after openModal so it isn't cleared by openModal's reset
            const providerParam = $page.url.searchParams.get('provider');
            if (errorParam === 'account_exists' && providerParam) {
                formError = `An account with this email already exists using ${providerParam}. Please sign in with ${providerParam}.`;
            } else {
                formError = SOCIAL_ERRORS[errorParam];
            }
        }
    });

    // ── Modal helpers ─────────────────────────────────────────────────────────

    function openModal(initialMode: 'login' | 'signup' = 'login') {
        mode       = initialMode;
        errors     = {};
        formError  = '';
        showSuccess = false;
        modalOpen  = true;
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        if (isLoading) return;
        modalOpen = false;
        document.body.style.overflow = '';
    }

    function handleBackdropClick(e: MouseEvent) {
        if ((e.target as HTMLElement).classList.contains('modal-backdrop')) {
            closeModal();
        }
    }

    function handleModalKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape') { closeModal(); return; }
        if (e.key === 'Enter') {
            if (mode === 'login') {
                handleLogin();
            } else {
                handleSignup();
            }
        }
    }

    // ── Client-side validation ────────────────────────────────────────────────

    function validateLogin(): boolean {
        const e: Record<string, string> = {};
        if (!loginEmail.trim()) e.email = 'Email is required.';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail)) e.email = 'Please enter a valid email.';
        if (!loginPassword) e.password = 'Password is required.';
        errors = e;
        return Object.keys(e).length === 0;
    }

    function validateSignup(): boolean {
        const e: Record<string, string> = {};
        if (!signupName.trim()) e.name = 'Name is required.';
        if (!signupEmail.trim()) e.email = 'Email is required.';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupEmail)) e.email = 'Please enter a valid email.';
        if (!signupPassword) e.password = 'Password is required.';
        else if (signupPassword.length < 8) e.password = 'Password must be at least 8 characters.';
        if (signupPassword !== signupConfirm) e.confirmPassword = 'Passwords do not match.';
        errors = e;
        return Object.keys(e).length === 0;
    }

    // ── Submit handlers ───────────────────────────────────────────────────────

    async function handleLogin() {
        formError = '';
        if (!validateLogin()) return;
        isLoading = true;

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: loginEmail, password: loginPassword })
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                if (data.errors?._form) formError = data.errors._form;
                else if (data.errors) errors = data.errors;
                else formError = 'Login failed. Please try again.';
                isLoading = false;
                return;
            }

            await goto('/home', { replaceState: true });
        } catch {
            formError = 'Network error. Please check your connection.';
            isLoading = false;
        }
    }

    async function handleSignup() {
        formError = '';
        if (!validateSignup()) return;
        isLoading = true;

        try {
            const res = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: signupName,
                    email: signupEmail,
                    password: signupPassword,
                    confirmPassword: signupConfirm
                })
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                if (data.errors?._form) formError = data.errors._form;
                else if (data.errors) errors = data.errors;
                else formError = 'Signup failed. Please try again.';
                isLoading = false;
                return;
            }

            showSuccess = true;
            setTimeout(() => {
                goto('/home', { replaceState: true });
            }, 1200);
        } catch {
            formError = 'Network error. Please check your connection.';
            isLoading = false;
        }
    }


    function switchMode(newMode: 'login' | 'signup') {
        mode      = newMode;
        errors    = {};
        formError = '';
    }

    // ── Social Login ──────────────────────────────────────────────────────────

    function handleGoogleLogin() {
        window.location.href = '/api/auth/google/redirect';
    }

    function handleAppleLogin() {
        window.location.href = '/api/auth/apple/redirect';
    }
</script>

<svelte:head>
    <title>Welcome to DecoHub</title>
    <meta name="description" content="Design your perfect space with DecoHub — our interactive 3D furniture studio." />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous">
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:opsz,wght@9..40,400;500;700&display=swap" rel="stylesheet">
</svelte:head>

<!-- ── Full-bleed Hero ── -->
<div class="hero-page">

    <!-- Background image + gradient overlay -->
    <div class="hero-bg">
        <img src="/hero_room.jpg" alt="Modern luxury interior" />
        <div class="hero-overlay"></div>
    </div>

    <!-- Floating ambient particles -->
    <div class="particles" aria-hidden="true">
        {#each Array(8) as _, i}
            <div class="particle" style="--delay:{i * 1.8}s; --x:{10 + i * 11}%; --size:{3 + (i % 3) * 2}px;"></div>
        {/each}
    </div>

    <!-- ── Top-bar ── -->
    <header class="topbar">
        <div class="topbar-logo">
            <svg viewBox="0 0 40 40" width="32" height="32" fill="none">
                <path d="M20 4L36 13v14L20 36 4 27V13L20 4z" stroke="#C9A96E" stroke-width="1.5" fill="none"/>
                <path d="M20 4L36 13L20 22 4 13L20 4z" fill="rgba(201,169,110,0.18)" stroke="#C9A96E" stroke-width="1"/>
                <path d="M20 22v14" stroke="#C9A96E" stroke-width="1"/>
                <path d="M4 13v14L20 36" stroke="#C9A96E" stroke-width="1" opacity="0.5"/>
                <path d="M36 13v14L20 36" stroke="#C9A96E" stroke-width="1" opacity="0.5"/>
            </svg>
            <span class="topbar-brand">DecoHub</span>
        </div>

        <button
            id="hero-login-btn"
            class="hero-login-btn"
            onclick={() => openModal('login')}
            aria-haspopup="dialog"
        >
            Login
        </button>
    </header>

    <!-- ── Hero content ── -->
    <main class="hero-content">
        <div class="hero-logo" aria-hidden="true">
            <svg viewBox="0 0 40 40" width="64" height="64" fill="none">
                <path d="M20 4L36 13v14L20 36 4 27V13L20 4z" stroke="#C9A96E" stroke-width="1.5" fill="none"/>
                <path d="M20 4L36 13L20 22 4 13L20 4z" fill="rgba(201,169,110,0.15)" stroke="#C9A96E" stroke-width="1"/>
                <path d="M20 22v14" stroke="#C9A96E" stroke-width="1"/>
                <path d="M4 13v14L20 36" stroke="#C9A96E" stroke-width="1" opacity="0.5"/>
                <path d="M36 13v14L20 36" stroke="#C9A96E" stroke-width="1" opacity="0.5"/>
            </svg>
        </div>

        <h1>Welcome to<br/><span class="brand">DecoHub</span></h1>

        <p class="hero-tagline">
            Design your perfect space with our interactive 3D studio.<br/>
            Pick, arrange, and visualize furniture — all in your browser.
        </p>

        <div class="feature-pills">
            <div class="pill">🛋️ 50+ Furniture Models</div>
            <div class="pill">🎨 Custom Materials</div>
            <div class="pill">💾 Save &amp; Share</div>
        </div>
    </main>

    <!-- ── Footer ── -->
    <footer class="hero-footer">
        © 2026 DecoHub. All rights reserved.
    </footer>
</div>

<!-- ── Auth Modal ── -->
{#if modalOpen}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
        class="modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-label="Authentication"
        onclick={handleBackdropClick}
        onkeydown={handleModalKeydown}
    >
        <div class="modal-card">

            <!-- Close button -->
            <button
                class="modal-close"
                onclick={closeModal}
                aria-label="Close authentication modal"
                disabled={isLoading}
            >
                ✕
            </button>

            <!-- Logo -->
            <div class="modal-logo" aria-hidden="true">
                <svg viewBox="0 0 40 40" width="48" height="48" fill="none">
                    <circle cx="20" cy="20" r="19" stroke="rgba(201,169,110,0.3)" stroke-width="1" fill="rgba(201,169,110,0.06)"/>
                    <path d="M20 10L30 16v8L20 30 10 24v-8L20 10z" stroke="#C9A96E" stroke-width="1.5" fill="none"/>
                    <path d="M20 10L30 16L20 22 10 16L20 10z" fill="rgba(201,169,110,0.2)" stroke="#C9A96E" stroke-width="1"/>
                    <path d="M20 22v8" stroke="#C9A96E" stroke-width="1"/>
                </svg>
            </div>

            <!-- Heading -->
            <h2>{mode === 'login' ? 'Login' : 'Create Account'}</h2>
            <p class="modal-subtitle">
                {mode === 'login'
                    ? 'Login to your account to continue'
                    : 'Sign up to start designing your space'}
            </p>

            <!-- Login / Sign Up pill tabs -->
            <div class="tab-switcher" role="tablist" aria-label="Authentication mode">
                <button
                    type="button"
                    role="tab"
                    id="tab-login"
                    class="tab-btn"
                    class:active={mode === 'login'}
                    aria-selected={mode === 'login'}
                    onclick={() => switchMode('login')}
                >Login</button>
                <button
                    type="button"
                    role="tab"
                    id="tab-signup"
                    class="tab-btn"
                    class:active={mode === 'signup'}
                    aria-selected={mode === 'signup'}
                    onclick={() => switchMode('signup')}
                >Sign Up</button>
            </div>

            <!-- Form error banner -->
            {#if formError}
                <div class="form-error-banner">
                    <span class="error-icon">⚠</span>
                    {formError}
                </div>
            {/if}

            <!-- Success overlay -->
            {#if showSuccess}
                <div class="success-overlay">
                    <div class="success-check">✓</div>
                    <p>Account created!</p>
                </div>
            {/if}

            <!-- ── Login Form ── -->
            {#if mode === 'login'}
                <div class="form-fields" class:hidden={showSuccess}>
                    <!-- Manual email/password fields -->
                    <div class="field">
                        <label for="login-email">Email Address</label>
                        <div class="input-wrap" class:error={errors.email}>
                            <span class="input-icon">✉</span>
                            <input id="login-email" type="email" placeholder="you@example.com"
                                bind:value={loginEmail} autocomplete="email" />
                        </div>
                        {#if errors.email}<span class="field-error">{errors.email}</span>{/if}
                    </div>

                    <div class="field">
                        <label for="login-password">Password</label>
                        <div class="input-wrap" class:error={errors.password}>
                            <span class="input-icon">🔒</span>
                            <input id="login-password"
                                type={loginShowPassword ? 'text' : 'password'}
                                placeholder="••••••••"
                                bind:value={loginPassword}
                                autocomplete="current-password" />
                            <button class="toggle-pw" type="button"
                                onclick={() => loginShowPassword = !loginShowPassword}
                                aria-label="Toggle password visibility">
                                {loginShowPassword ? '🙈' : '👁'}
                            </button>
                        </div>
                        {#if errors.password}<span class="field-error">{errors.password}</span>{/if}
                    </div>

                    <button class="submit-btn" type="button" onclick={handleLogin} disabled={isLoading}>
                        {#if isLoading}
                            <span class="spinner"></span>
                        {:else}
                            Login <span class="arrow">→</span>
                        {/if}
                    </button>

                    <!-- Or continue with -->
                    <div class="social-divider" aria-hidden="true">
                        <span class="divider-line"></span>
                        <span class="divider-text">Or continue with</span>
                        <span class="divider-line"></span>
                    </div>

                    <!-- Social Buttons -->
                    <div class="social-buttons">
                        <!-- Google -->
                        <button
                            id="social-google-login"
                            type="button"
                            class="social-btn"
                            onclick={handleGoogleLogin}
                            disabled={isLoading}
                            aria-label="Continue with Google"
                        >
                            <svg class="social-icon" viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                            </svg>
                            <span>Continue with Google</span>
                        </button>

                        <!-- Apple -->
                        <button
                            id="social-apple-login"
                            type="button"
                            class="social-btn"
                            onclick={handleAppleLogin}
                            disabled={isLoading}
                            aria-label="Continue with Apple"
                        >
                            <svg class="social-icon" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.38.07 2.33.74 3.13.8.5.04 2.03-.87 3.45-.74 1.57.16 2.75.88 3.46 2.24-3.54 1.73-2.96 6.02.74 7.35-.62 1.3-1.27 2.58-2.78 3.23zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                            </svg>
                            <span>Continue with Apple</span>
                        </button>
                    </div>

                    <p class="switch-prompt">
                        Don't have an account?
                        <button type="button" class="link-btn" onclick={() => switchMode('signup')}>Sign up</button>
                    </p>
                </div>

            <!-- ── Sign Up Form ── -->
            {:else}
                <div class="form-fields" class:hidden={showSuccess}>
                    <div class="field">
                        <label for="signup-name">Full Name</label>
                        <div class="input-wrap" class:error={errors.name}>
                            <span class="input-icon">👤</span>
                            <input id="signup-name" type="text" placeholder="John Doe"
                                bind:value={signupName} autocomplete="name" />
                        </div>
                        {#if errors.name}<span class="field-error">{errors.name}</span>{/if}
                    </div>

                    <div class="field">
                        <label for="signup-email">Email Address</label>
                        <div class="input-wrap" class:error={errors.email}>
                            <span class="input-icon">✉</span>
                            <input id="signup-email" type="email" placeholder="you@example.com"
                                bind:value={signupEmail} autocomplete="email" />
                        </div>
                        {#if errors.email}<span class="field-error">{errors.email}</span>{/if}
                    </div>

                    <div class="field">
                        <label for="signup-password">Password</label>
                        <div class="input-wrap" class:error={errors.password}>
                            <span class="input-icon">🔒</span>
                            <input id="signup-password"
                                type={signupShowPassword ? 'text' : 'password'}
                                placeholder="Min. 8 characters"
                                bind:value={signupPassword}
                                autocomplete="new-password" />
                            <button class="toggle-pw" type="button"
                                onclick={() => signupShowPassword = !signupShowPassword}
                                aria-label="Toggle password visibility">
                                {signupShowPassword ? '🙈' : '👁'}
                            </button>
                        </div>
                        {#if errors.password}<span class="field-error">{errors.password}</span>{/if}
                    </div>

                    <div class="field">
                        <label for="signup-confirm">Confirm Password</label>
                        <div class="input-wrap" class:error={errors.confirmPassword}>
                            <span class="input-icon">🔒</span>
                            <input id="signup-confirm"
                                type={signupShowPassword ? 'text' : 'password'}
                                placeholder="Re-enter password"
                                bind:value={signupConfirm}
                                autocomplete="new-password" />
                        </div>
                        {#if errors.confirmPassword}<span class="field-error">{errors.confirmPassword}</span>{/if}
                    </div>

                    <button class="submit-btn" type="button" onclick={handleSignup} disabled={isLoading}>
                        {#if isLoading}
                            <span class="spinner"></span>
                        {:else}
                            Sign Up <span class="arrow">→</span>
                        {/if}
                    </button>

                    <!-- Or continue with -->
                    <div class="social-divider" aria-hidden="true">
                        <span class="divider-line"></span>
                        <span class="divider-text">Or continue with</span>
                        <span class="divider-line"></span>
                    </div>

                    <!-- Social Buttons -->
                    <div class="social-buttons">
                        <!-- Google -->
                        <button
                            id="social-google-signup"
                            type="button"
                            class="social-btn"
                            onclick={handleGoogleLogin}
                            disabled={isLoading}
                            aria-label="Continue with Google"
                        >
                            <svg class="social-icon" viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                            </svg>
                            <span>Continue with Google</span>
                        </button>

                        <!-- Apple -->
                        <button
                            id="social-apple-signup"
                            type="button"
                            class="social-btn"
                            onclick={handleAppleLogin}
                            disabled={isLoading}
                            aria-label="Continue with Apple"
                        >
                            <svg class="social-icon" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.38.07 2.33.74 3.13.8.5.04 2.03-.87 3.45-.74 1.57.16 2.75.88 3.46 2.24-3.54 1.73-2.96 6.02.74 7.35-.62 1.3-1.27 2.58-2.78 3.23zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                            </svg>
                            <span>Continue with Apple</span>
                        </button>
                    </div>

                    <p class="switch-prompt">
                        Already have an account?
                        <button type="button" class="link-btn" onclick={() => switchMode('login')}>Login</button>
                    </p>
                </div>
            {/if}

            <!-- Security footer -->
            <div class="security-footer">
                <span>🛡</span> Your data is secure with us
            </div>
        </div>
    </div>
{/if}

<style>
    /* ── Design tokens ──────────────────────────────────────────────────────── */
    :root {
        --gold:          #C9A96E;
        --gold-light:    #D4B97A;
        --gold-dark:     #B8924E;
        --bg:            #0D0D0D;
        --card:          #1A1A1A;
        --input-bg:      #242424;
        --border:        #333;
        --text:          #FFFFFF;
        --text-secondary:#999;
        --text-muted:    #666;
        --error:         #E74C3C;
        --success:       #2ECC71;
        --font-display:  'Cormorant Garamond', serif;
        --font-body:     'DM Sans', sans-serif;
    }

    :global(body) {
        margin:  0;
        padding: 0;
        background: var(--bg);
    }

    /* ── Full-bleed Hero ────────────────────────────────────────────────────── */
    .hero-page {
        position:   relative;
        width:      100vw;
        min-height: 100vh;
        overflow:   hidden;
        font-family: var(--font-body);
        color:      var(--text);
        display:    flex;
        flex-direction: column;
    }

    /* Background image */
    .hero-bg {
        position:  absolute;
        inset:     0;
        z-index:   0;
    }

    .hero-bg img {
        width:       100%;
        height:      100%;
        object-fit:  cover;
        object-position: center;
    }

    /* Gradient overlay: dark on edges, clear in the middle */
    .hero-overlay {
        position:   absolute;
        inset:      0;
        background: linear-gradient(
            180deg,
            rgba(13,13,13,0.72) 0%,
            rgba(13,13,13,0.35) 40%,
            rgba(13,13,13,0.70) 100%
        );
    }

    /* Particles */
    .particles {
        position:       absolute;
        inset:          0;
        z-index:        1;
        pointer-events: none;
        overflow:       hidden;
    }

    .particle {
        position:     absolute;
        bottom:       -10px;
        left:         var(--x);
        width:        var(--size);
        height:       var(--size);
        background:   radial-gradient(circle, rgba(201,169,110,0.45), transparent);
        border-radius: 50%;
        animation:    floatUp 14s var(--delay) infinite ease-in-out;
    }

    @keyframes floatUp {
        0%   { transform: translateY(0) scale(1);    opacity: 0;   }
        10%  { opacity: 0.6; }
        90%  { opacity: 0.2; }
        100% { transform: translateY(-100vh) scale(0.3); opacity: 0; }
    }

    /* ── Top-bar ────────────────────────────────────────────────────────────── */
    .topbar {
        position:        relative;
        z-index:         10;
        display:         flex;
        align-items:     center;
        justify-content: space-between;
        padding:         1.25rem 2.5rem;
        animation:       fadeDown 0.7s 0.1s both;
    }

    .topbar-logo {
        display:     flex;
        align-items: center;
        gap:         0.6rem;
    }

    .topbar-brand {
        font-family: var(--font-display);
        font-size:   1.35rem;
        font-weight: 700;
        color:       var(--gold);
        letter-spacing: 0.02em;
    }

    /* Gold pill Login button in the top-right */
    .hero-login-btn {
        padding:       0.6rem 1.6rem;
        border:        1.5px solid rgba(201,169,110,0.55);
        border-radius: 9999px;
        background:    rgba(201,169,110,0.08);
        color:         var(--gold-light);
        font-family:   var(--font-body);
        font-size:     0.9rem;
        font-weight:   600;
        cursor:        pointer;
        backdrop-filter: blur(4px);
        transition:    all 0.25s ease;
    }

    .hero-login-btn:hover {
        background:    rgba(201,169,110,0.18);
        border-color:  var(--gold);
        color:         #fff;
        transform:     translateY(-1px);
        box-shadow:    0 4px 18px rgba(201,169,110,0.22);
    }

    /* ── Hero main content ──────────────────────────────────────────────────── */
    .hero-content {
        position:        relative;
        z-index:         5;
        flex:            1;
        display:         flex;
        flex-direction:  column;
        align-items:     center;
        justify-content: center;
        text-align:      center;
        padding:         3rem 2rem 2rem;
        animation:       fadeInUp 0.9s 0.3s both;
    }

    .hero-logo {
        margin-bottom: 1.8rem;
        opacity:       0;
        animation:     fadeInUp 0.8s 0.4s forwards;
    }

    .hero-content h1 {
        font-family:  var(--font-display);
        font-size:    clamp(2.8rem, 6vw, 5rem);
        font-weight:  600;
        line-height:  1.12;
        margin:       0 0 1.2rem;
        color:        #fff;
        opacity:      0;
        animation:    fadeInUp 0.8s 0.5s forwards;
        text-shadow:  0 2px 20px rgba(0,0,0,0.5);
    }

    .brand {
        color:       var(--gold);
        font-weight: 700;
    }

    .hero-tagline {
        font-size:  clamp(1rem, 2vw, 1.15rem);
        line-height: 1.75;
        color:      rgba(255,255,255,0.78);
        max-width:  560px;
        margin:     0 0 2rem;
        opacity:    0;
        animation:  fadeInUp 0.8s 0.65s forwards;
    }

    .feature-pills {
        display:         flex;
        flex-wrap:       wrap;
        gap:             0.6rem;
        justify-content: center;
        margin:          0;
        opacity:         0;
        animation:       fadeInUp 0.8s 0.8s forwards;
    }

    .pill {
        padding:         0.5rem 1.1rem;
        background:      rgba(201,169,110,0.1);
        border:          1px solid rgba(201,169,110,0.28);
        border-radius:   100px;
        font-size:       0.82rem;
        color:           var(--gold-light);
        white-space:     nowrap;
        backdrop-filter: blur(6px);
    }

    /* ── Hero footer ────────────────────────────────────────────────────────── */
    .hero-footer {
        position:   relative;
        z-index:    5;
        text-align: center;
        font-size:  0.78rem;
        color:      rgba(255,255,255,0.28);
        padding:    1.2rem;
        opacity:    0;
        animation:  fadeInUp 0.8s 1.1s forwards;
    }

    /* ── Modal backdrop ─────────────────────────────────────────────────────── */
    .modal-backdrop {
        position:   fixed;
        inset:      0;
        z-index:    100;
        display:    flex;
        align-items: center;
        justify-content: center;
        padding:    1rem;
        background: rgba(0,0,0,0.65);
        backdrop-filter: blur(8px);
        animation:  backdropIn 0.25s ease both;
    }

    @keyframes backdropIn {
        from { opacity: 0; }
        to   { opacity: 1; }
    }

    /* ── Modal card ─────────────────────────────────────────────────────────── */
    .modal-card {
        position:       relative;
        width:          100%;
        max-width:      440px;
        max-height:     90vh;
        overflow-y:     auto;
        background:     #1A1A1A;
        border:         1px solid rgba(255,255,255,0.09);
        border-radius:  22px;
        padding:        2.4rem 2.2rem 2rem;
        box-shadow:     0 24px 60px rgba(0,0,0,0.7);
        display:        flex;
        flex-direction: column;
        align-items:    center;
        box-sizing:     border-box;
        animation:      cardIn 0.35s cubic-bezier(0.175,0.885,0.32,1.275) both;
    }

    @keyframes cardIn {
        from { opacity: 0; transform: translateY(32px) scale(0.96); }
        to   { opacity: 1; transform: translateY(0)    scale(1);    }
    }

    /* Scrollbar inside modal */
    .modal-card::-webkit-scrollbar        { width: 5px; }
    .modal-card::-webkit-scrollbar-track  { background: transparent; }
    .modal-card::-webkit-scrollbar-thumb  { background: #333; border-radius: 9999px; }

    /* Close button */
    .modal-close {
        position:   absolute;
        top:        1rem;
        right:      1rem;
        width:      32px;
        height:     32px;
        border:     none;
        border-radius: 50%;
        background: rgba(255,255,255,0.07);
        color:      rgba(255,255,255,0.55);
        font-size:  0.8rem;
        cursor:     pointer;
        display:    flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        line-height: 1;
    }

    .modal-close:hover:not(:disabled) {
        background: rgba(255,255,255,0.14);
        color:      #fff;
    }

    /* Modal logo */
    .modal-logo {
        margin-bottom: 1.2rem;
        animation:     fadeInUp 0.5s 0.05s both;
    }

    /* Modal heading */
    .modal-card h2 {
        font-family: var(--font-display);
        font-size:   1.9rem;
        font-weight: 600;
        margin:      0 0 0.3rem;
        text-align:  center;
        animation:   fadeInUp 0.5s 0.1s both;
    }

    .modal-subtitle {
        font-size:  0.88rem;
        color:      var(--text-secondary);
        margin:     0 0 1.5rem;
        text-align: center;
        animation:  fadeInUp 0.5s 0.15s both;
    }

    /* ── Tab Switcher ───────────────────────────────────────────────────────── */
    .tab-switcher {
        display:   flex;
        width:     100%;
        background: #111;
        border:    1px solid rgba(255,255,255,0.08);
        border-radius: 9999px;
        padding:   4px;
        margin-bottom: 1.5rem;
        box-sizing: border-box;
        animation:  fadeInUp 0.5s 0.2s both;
    }

    .tab-btn {
        flex:        1;
        padding:     0.6rem 1rem;
        border:      none;
        background:  transparent;
        color:       #888;
        font-family: var(--font-body);
        font-weight: 600;
        font-size:   0.88rem;
        cursor:      pointer;
        border-radius: 9999px;
        transition:  all 0.25s cubic-bezier(0.4,0,0.2,1);
        text-align:  center;
        user-select: none;
    }

    .tab-btn:hover:not(.active) { color: #ddd; }

    .tab-btn.active {
        background: #fff;
        color:      #121212;
        box-shadow: 0 2px 10px rgba(0,0,0,0.35);
    }

    /* ── Form error banner ──────────────────────────────────────────────────── */
    .form-error-banner {
        width:        100%;
        padding:      0.7rem 1rem;
        background:   rgba(231,76,60,0.1);
        border:       1px solid rgba(231,76,60,0.25);
        border-radius: 10px;
        color:        #E74C3C;
        font-size:    0.86rem;
        font-weight:  500;
        display:      flex;
        align-items:  center;
        gap:          0.5rem;
        margin-bottom: 1rem;
        animation:    shakeIn 0.4s ease;
        box-sizing:   border-box;
    }

    .error-icon { flex-shrink: 0; }

    @keyframes shakeIn {
        0%   { transform: translateX(-8px); opacity: 0; }
        25%  { transform: translateX(6px);  }
        50%  { transform: translateX(-4px); }
        75%  { transform: translateX(2px);  }
        100% { transform: translateX(0);    opacity: 1; }
    }

    /* ── Success overlay ────────────────────────────────────────────────────── */
    .success-overlay {
        display:        flex;
        flex-direction: column;
        align-items:    center;
        padding:        2.5rem 0;
        animation:      fadeInUp 0.5s ease both;
    }

    .success-check {
        width:         68px;
        height:        68px;
        border-radius: 50%;
        background:    linear-gradient(135deg, var(--success), #27ae60);
        color:         #fff;
        font-size:     2rem;
        display:       flex;
        align-items:   center;
        justify-content: center;
        margin-bottom: 0.9rem;
        animation:     popIn 0.5s cubic-bezier(0.175,0.885,0.32,1.275) both;
    }

    .success-overlay p {
        font-size:  1rem;
        font-weight: 600;
        color:      var(--success);
    }

    @keyframes popIn {
        0%   { transform: scale(0); }
        80%  { transform: scale(1.15); }
        100% { transform: scale(1); }
    }

    /* ── Form fields ────────────────────────────────────────────────────────── */
    .form-fields {
        width:          100%;
        display:        flex;
        flex-direction: column;
        gap:            1rem;
        animation:      fadeInUp 0.35s ease both;
    }

    .form-fields.hidden { display: none; }

    .field {
        display:        flex;
        flex-direction: column;
        gap:            0.35rem;
    }

    .field label {
        font-size:   0.82rem;
        font-weight: 600;
        color:       var(--text-secondary);
    }

    .input-wrap {
        display:     flex;
        align-items: center;
        background:  var(--input-bg);
        border:      1.5px solid var(--border);
        border-radius: 10px;
        padding:     0 1rem;
        transition:  border-color 0.2s, box-shadow 0.2s;
    }

    .input-wrap:focus-within {
        border-color: var(--gold);
        box-shadow:   0 0 0 3px rgba(201,169,110,0.12);
    }

    .input-wrap.error {
        border-color: var(--error);
        box-shadow:   0 0 0 3px rgba(231,76,60,0.1);
    }

    .input-icon {
        font-size:    0.9rem;
        margin-right: 0.65rem;
        opacity:      0.5;
        flex-shrink:  0;
    }

    .input-wrap input {
        flex:        1;
        background:  transparent;
        border:      none;
        outline:     none;
        padding:     0.8rem 0;
        font-size:   0.92rem;
        color:       var(--text);
        font-family: var(--font-body);
    }

    .input-wrap input::placeholder { color: var(--text-muted); }

    .toggle-pw {
        background: none;
        border:     none;
        cursor:     pointer;
        font-size:  0.95rem;
        padding:    0.3rem;
        opacity:    0.5;
        transition: opacity 0.2s;
    }

    .toggle-pw:hover { opacity: 0.85; }

    .field-error {
        font-size:  0.76rem;
        color:      var(--error);
        font-weight: 500;
        padding-left: 0.2rem;
    }



    /* ── Submit button ──────────────────────────────────────────────────────── */
    .submit-btn {
        width:         100%;
        padding:       0.9rem;
        border:        none;
        border-radius: 10px;
        background:    linear-gradient(135deg, var(--gold), var(--gold-dark));
        color:         #1A1A1A;
        font-family:   var(--font-body);
        font-size:     0.95rem;
        font-weight:   700;
        cursor:        pointer;
        display:       flex;
        align-items:   center;
        justify-content: center;
        gap:           0.5rem;
        transition:    all 0.3s cubic-bezier(0.175,0.885,0.32,1.275);
        margin-top:    0.4rem;
        box-shadow:    0 4px 15px rgba(201,169,110,0.25);
    }

    .submit-btn:hover:not(:disabled) {
        transform:    translateY(-2px);
        box-shadow:   0 8px 25px rgba(201,169,110,0.4);
        background:   linear-gradient(135deg, var(--gold-light), var(--gold));
    }

    .submit-btn:active:not(:disabled) { transform: translateY(0); }
    .submit-btn:disabled { opacity: 0.7; cursor: not-allowed; }

    .arrow { font-size: 1.1rem; transition: transform 0.3s; }
    .submit-btn:hover:not(:disabled) .arrow { transform: translateX(4px); }

    /* ── Spinners ───────────────────────────────────────────────────────────── */
    .spinner {
        width:         18px;
        height:        18px;
        border:        2.5px solid rgba(26,26,26,0.3);
        border-top-color: #1A1A1A;
        border-radius: 50%;
        animation:     spin 0.6s linear infinite;
    }



    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Switch prompt ──────────────────────────────────────────────────────── */
    .switch-prompt {
        text-align: center;
        font-size:  0.86rem;
        color:      var(--text-secondary);
        margin:     0.6rem 0 0;
    }

    .link-btn {
        background:  none;
        border:      none;
        color:       var(--gold);
        font-weight: 700;
        cursor:      pointer;
        font-size:   0.86rem;
        font-family: var(--font-body);
        transition:  color 0.2s;
    }

    .link-btn:hover {
        color: var(--gold-light);
        text-decoration: underline;
    }

    /* ── Security footer (inside modal) ─────────────────────────────────────── */
    .security-footer {
        margin-top:  1.6rem;
        font-size:   0.78rem;
        color:       var(--text-muted);
        display:     flex;
        align-items: center;
        gap:         0.35rem;
    }

    /* ── Shared animations ──────────────────────────────────────────────────── */
    @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(20px); }
        to   { opacity: 1; transform: translateY(0);    }
    }

    @keyframes fadeDown {
        from { opacity: 0; transform: translateY(-12px); }
        to   { opacity: 1; transform: translateY(0);     }
    }

    /* ── Responsive ─────────────────────────────────────────────────────────── */
    @media (max-width: 600px) {
        .topbar { padding: 1rem 1.25rem; }

        .topbar-brand { font-size: 1.15rem; }

        .hero-login-btn {
            padding:   0.5rem 1.1rem;
            font-size: 0.82rem;
        }

        .hero-content { padding: 2rem 1.25rem 1.5rem; }

        .modal-card { padding: 2rem 1.4rem 1.6rem; }
    }

    /* ── Social Login Divider ───────────────────────────────────────────────── */
    .social-divider {
        display:     flex;
        align-items: center;
        gap:         0.75rem;
        width:       100%;
        margin:      0.25rem 0;
    }

    .divider-line {
        flex:         1;
        height:       1px;
        background:   rgba(255,255,255,0.1);
    }

    .divider-text {
        font-size:      0.76rem;
        color:          var(--text-muted);
        white-space:    nowrap;
        letter-spacing: 0.03em;
        text-transform: uppercase;
    }

    /* ── Social Button Container ────────────────────────────────────────────── */
    .social-buttons {
        display:        flex;
        flex-direction: column;
        gap:            0.6rem;
        width:          100%;
    }

    /* ── Social Button ──────────────────────────────────────────────────────── */
    .social-btn {
        width:           100%;
        display:         flex;
        align-items:     center;
        justify-content: center;
        gap:             0.65rem;
        padding:         0.72rem 1.1rem;
        background:      rgba(255,255,255,0.04);
        border:          1.5px solid rgba(255,255,255,0.1);
        border-radius:   10px;
        color:           rgba(255,255,255,0.88);
        font-family:     var(--font-body);
        font-size:       0.9rem;
        font-weight:     500;
        cursor:          pointer;
        transition:      all 0.22s cubic-bezier(0.4,0,0.2,1);
        backdrop-filter: blur(4px);
        box-sizing:      border-box;
        position:        relative;
        letter-spacing:  0.01em;
    }

    .social-btn:hover:not(:disabled) {
        background:   rgba(201,169,110,0.08);
        border-color: rgba(201,169,110,0.4);
        color:        #fff;
        transform:    translateY(-1px);
        box-shadow:   0 4px 16px rgba(0,0,0,0.25);
    }

    .social-btn:active:not(:disabled) {
        transform: translateY(0);
    }

    .social-icon {
        width:     20px;
        height:    20px;
        flex-shrink: 0;
        color:     #fff;
    }
</style>
