/* ===============================================================
   ResQLink — Professional Landing Page JS
   Intersections, Counters, and Scroll Effects
   =============================================================== */

document.addEventListener("DOMContentLoaded", () => {
    // ─── NAVBAR SCROLL EFFECT ──────────────────────────────────
    const navbar = document.getElementById("navbar");
    window.addEventListener("scroll", () => {
        if (window.scrollY > 50) {
            navbar.classList.add("scrolled");
        } else {
            navbar.classList.remove("scrolled");
        }
    });

    // ─── REVEAL ON SCROLL ──────────────────────────────────────
    const reveals = document.querySelectorAll(".reveal");
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("active");
                // If it's a stat card, start the counter
                if (entry.target.classList.contains("stats-container")) {
                    startCounters();
                }
            }
        });
    }, { threshold: 0.15 });

    reveals.forEach(el => revealObserver.observe(el));

    // ─── STATS COUNTER ANIMATION ───────────────────────────────
    let countersStarted = false;
    function startCounters() {
        if (countersStarted) return;
        countersStarted = true;

        const counters = document.querySelectorAll(".stat-number");
        counters.forEach(counter => {
            const target = +counter.getAttribute("data-target");
            const count = 0;
            const speed = 1000; // Animation duration in ms

            const updateCount = () => {
                const current = +counter.innerText.replace("+", "").replace(",", "");
                const increment = target / (speed / 16); // 16ms is roughly 60fps

                if (current < target) {
                    let next = current + increment;
                    if (next >= target) next = target;
                    
                    // Format output
                    if (Number.isInteger(target)) {
                        counter.innerText = Math.ceil(next).toLocaleString() + (target > 1000 ? "+" : "");
                    } else {
                        counter.innerText = next.toFixed(1);
                    }
                    setTimeout(updateCount, 16);
                } else {
                    counter.innerText = target.toLocaleString() + (target > 1000 ? "+" : "");
                }
            };

            updateCount();
        });
    }

    // ─── PARALLAX EFFECT FOR HERO IMAGE ──────────────────────
    const heroImage = document.querySelector(".hero-image");
    if (heroImage) {
        window.addEventListener("mousemove", (e) => {
            const x = (window.innerWidth / 2 - e.pageX) / 40;
            const y = (window.innerHeight / 2 - e.pageY) / 40;
            heroImage.style.transform = `translateX(${x}px) translateY(${y}px)`;
        });
    }
});
