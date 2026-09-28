<script lang="ts">
    import HeroSlideshow from '$lib/components/HeroSlideshow.svelte';

    let { data } = $props();
    let loggingOut = $state(false);

    async function handleLogout() {
        if (loggingOut) return;
        loggingOut = true;
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            window.location.href = '/login';
        } catch {
            loggingOut = false;
        }
    }
</script>

<svelte:head>
    <title>DecoHub — See it furnished</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous">
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:opsz,wght@9..40,400;500;700&display=swap" rel="stylesheet">
</svelte:head>

<div class="landing-page">
    <nav class="navbar">
        <div class="logo">DecoHub</div>
        <div class="nav-links">
            <a href="#features">Features</a>
            <a href="#how-it-works">How it Works</a>
        </div>
        <div class="nav-right">
            {#if data.user}
                <span class="user-greeting">Hi, {data.user.name}</span>
            {/if}
            <button class="btn-logout" onclick={handleLogout} disabled={loggingOut}>
                {loggingOut ? '...' : '⎋ Logout'}
            </button>
        </div>
    </nav>

    <header class="hero">
        <HeroSlideshow>
            <div class="hero-content fade-up">
                <h1>See it furnished before you commit.</h1>
                <p>Design your perfect space with our interactive 3D studio. Pick from curated furniture, customise materials, and build your layout right in the browser.</p>
                <a href="/studio" class="btn-primary">Start Designing &rarr;</a>
            </div>
        </HeroSlideshow>
    </header>

    <section id="features" class="features">
        <div class="container">
            <h2 class="section-title">Design without limits</h2>
            <div class="features-grid">
                <div class="feature-card">
                    <div class="feature-icon">🛋️</div>
                    <h3>Curated Collections</h3>
                    <p>Explore high-quality 3D models across tables, seating, and decorative categories.</p>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">📐</div>
                    <h3>Move · Rotate · Scale</h3>
                    <p>Take full control of your scene. Position items exactly where you want them in 3D space.</p>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">🎨</div>
                    <h3>Endless Variations</h3>
                    <p>Duplicate your favorite pieces, recolor materials, and mix and match to find the perfect style.</p>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">💾</div>
                    <h3>Save your layouts</h3>
                    <p>Save multiple variations of a room to compare ideas or pick up where you left off later.</p>
                </div>
            </div>
        </div>
    </section>

    <section id="how-it-works" class="how-it-works">
        <div class="container">
            <h2 class="section-title">How it works</h2>
            <div class="steps-grid">
                <div class="step">
                    <div class="step-number">1</div>
                    <h3>Pick</h3>
                    <p>Select furniture and decor from our extensive 3D library.</p>
                </div>
                <div class="step">
                    <div class="step-number">2</div>
                    <h3>Arrange</h3>
                    <p>Place, rotate, and color coordinate your items in the virtual studio.</p>
                </div>
                <div class="step">
                    <div class="step-number">3</div>
                    <h3>Save</h3>
                    <p>Save your favorite arrangements to revisit anytime.</p>
                </div>
            </div>
        </div>
    </section>

    <footer class="footer">
        <div class="container">
            <div class="footer-content">
                <div class="footer-brand">DecoHub</div>
                <div class="footer-copy">&copy; 2026 DecoHub. All rights reserved.</div>
            </div>
        </div>
    </footer>
</div>

<style>
    /* Variables based on design plan */
    :root {
        --color-black: #1C1917;
        --color-brown: #3D2B1F;
        --color-gold: #C9A96E;
        --color-bg: #F5F0E8;
        --color-taupe: #7C6A5A;
        --color-cream: #EDE8DF;
        
        --font-display: 'Cormorant Garamond', serif;
        --font-body: 'DM Sans', sans-serif;
    }

    :global(body) {
        margin: 0;
        padding: 0;
        background-color: var(--color-bg);
        color: var(--color-taupe);
        font-family: var(--font-body);
        -webkit-font-smoothing: antialiased;
    }

    .container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 0 2rem;
    }

    /* Typography */
    h1, h2, h3, .logo, .footer-brand {
        font-family: var(--font-display);
        color: var(--color-black);
        margin: 0;
    }

    /* Navbar */
    .navbar {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1.5rem 3rem;
        z-index: 100;
    }

    .logo {
        font-size: 2rem;
        font-weight: 700;
        color: white;
        text-shadow: 0 2px 4px rgba(0,0,0,0.3);
    }

    .nav-links {
        display: flex;
        gap: 2rem;
    }

    .nav-links a {
        color: white;
        text-decoration: none;
        font-weight: 500;
        font-size: 1rem;
        text-shadow: 0 1px 3px rgba(0,0,0,0.4);
        transition: color 0.2s;
    }

    .nav-links a:hover {
        color: var(--color-gold);
    }


    .btn-primary {
        display: inline-block;
        padding: 1rem 2rem;
        background-color: var(--color-gold);
        color: white;
        text-decoration: none;
        font-weight: 600;
        font-size: 1.1rem;
        border-radius: 4px;
        transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        box-shadow: 0 4px 15px rgba(201, 169, 110, 0.4);
    }

    .btn-primary:hover {
        background-color: #b8985c;
        transform: translateY(-3px) scale(1.02);
        box-shadow: 0 8px 20px rgba(201, 169, 110, 0.6);
    }

    /* Hero */
    .hero {
        position: relative;
        width: 100%;
        overflow: hidden;
    }

    .hero-content {
        position: relative;
        z-index: 10;
        max-width: 800px;
        padding: 0 2rem;
        text-align: center;
    }

    .hero-content h1 {
        color: white;
        font-size: 4.5rem;
        line-height: 1.1;
        margin-bottom: 1.5rem;
        text-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }

    .hero-content p {
        color: rgba(255, 255, 255, 0.9);
        font-size: 1.3rem;
        line-height: 1.6;
        margin-bottom: 2.5rem;
        max-width: 600px;
        margin-left: auto;
        margin-right: auto;
        text-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }

    /* Animations */
    @keyframes fadeUp {
        from {
            opacity: 0;
            transform: translateY(30px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .fade-up {
        animation: fadeUp 1s ease-out forwards;
    }

    /* Sections */
    .section-title {
        text-align: center;
        font-size: 3rem;
        margin-bottom: 4rem;
    }

    .features, .how-it-works {
        padding: 8rem 0;
    }

    .how-it-works {
        background-color: white;
    }

    /* Features Grid */
    .features-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 2rem;
    }

    .feature-card {
        background-color: var(--color-cream);
        padding: 2.5rem;
        border-radius: 8px;
        text-align: center;
        transition: transform 0.3s;
    }

    .feature-card:hover {
        transform: translateY(-5px);
    }

    .feature-icon {
        font-size: 3rem;
        margin-bottom: 1.5rem;
    }

    .feature-card h3 {
        font-size: 1.5rem;
        margin-bottom: 1rem;
    }

    .feature-card p {
        line-height: 1.6;
        margin: 0;
    }

    /* Steps Grid */
    .steps-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 3rem;
    }

    .step {
        text-align: center;
    }

    .step-number {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background-color: var(--color-brown);
        color: var(--color-gold);
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: var(--font-display);
        font-size: 2rem;
        font-weight: 700;
        margin: 0 auto 1.5rem;
    }

    .step h3 {
        font-size: 1.8rem;
        margin-bottom: 1rem;
    }

    .step p {
        line-height: 1.6;
    }

    /* Footer */
    .footer {
        background-color: var(--color-brown);
        color: rgba(255, 255, 255, 0.7);
        padding: 3rem 0;
    }

    .footer-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .footer-brand {
        color: var(--color-gold);
        font-size: 1.5rem;
    }

    /* Responsive */
    @media (max-width: 768px) {
        .navbar {
            padding: 1.5rem;
        }
        .nav-links {
            display: none;
        }
        .hero-content h1 {
            font-size: 3rem;
        }
        .hero-content p {
            font-size: 1.1rem;
        }
        .features, .how-it-works {
            padding: 4rem 0;
        }
        .section-title {
            font-size: 2.5rem;
            margin-bottom: 2rem;
        }
        .footer-content {
            flex-direction: column;
            gap: 1rem;
            text-align: center;
        }
        .nav-right {
            gap: 0.8rem;
        }
        .user-greeting {
            display: none;
        }
    }

    /* Auth nav additions */
    .nav-right {
        display: flex;
        align-items: center;
        gap: 1.2rem;
    }

    .user-greeting {
        color: rgba(255, 255, 255, 0.85);
        font-size: 0.95rem;
        font-weight: 500;
        text-shadow: 0 1px 3px rgba(0,0,0,0.4);
    }

    .btn-logout {
        padding: 0.5rem 1rem;
        border: 1.5px solid rgba(255,255,255,0.3);
        border-radius: 4px;
        background: rgba(255,255,255,0.08);
        color: rgba(255,255,255,0.85);
        font-weight: 500;
        font-size: 0.9rem;
        cursor: pointer;
        transition: all 0.2s;
        text-shadow: 0 1px 3px rgba(0,0,0,0.3);
    }

    .btn-logout:hover {
        background: rgba(255,255,255,0.15);
        border-color: rgba(255,255,255,0.5);
        color: white;
    }

    .btn-logout:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>
