"use strict";

document.addEventListener("DOMContentLoaded", () => {
    // =========================================
    // 1. ELEMENTS
    // =========================================

    const canvas = document.getElementById("hero-frame-canvas");
    const ctx = canvas ? canvas.getContext("2d") : null;

    const currentLabel = document.getElementById("frame-current");
    const progressBar = document.getElementById("frame-progress");

    // =========================================
    // 2. ANIMATION SETTINGS
    // =========================================

    const FRAME_COUNT = 60;
    const frames = new Array(FRAME_COUNT);

    let currentFrame = -1;
    let animationReady = false;
    let ticking = false;
    let loadedCount = 0;

    // =========================================
    // 3. LOAD ALL 60 ANIMATION FRAMES
    // =========================================

    function loadFrames() {
        if (!canvas || !ctx) {
            console.error("Everora: Animation canvas not found. Check the canvas ID.");
            return;
        }

        // Initialize canvas resolution
        resizeCanvas();

        for (let i = 1; i <= FRAME_COUNT; i++) {
            const image = new Image();
            const frameIndex = i - 1;
            const frameNumber = String(i).padStart(3, "0");

            frames[frameIndex] = image;

            image.onload = () => {
                loadedCount++;

                // As soon as the first frame or any frame is available, initialize rendering
                if (!animationReady) {
                    animationReady = true;
                    updateAnimation();
                }

                if (loadedCount === FRAME_COUNT) {
                    console.info("Everora: All animation frames loaded.");
                }
            };

            image.onerror = () => {
                loadedCount++;
                console.warn(`Everora: Frame ${frameNumber} failed to load from ${image.src}`);

                if (loadedCount === FRAME_COUNT) {
                    console.info("Everora: Frame loading completed with warnings.");
                }
            };

            // Verified path to sequential frames
            image.src = `assets/frames/frame-${frameNumber}.jpg`;
        }
    }

    // =========================================
    // 4. RESIZE CANVAS RESOLUTION
    // =========================================

    function resizeCanvas() {
        if (!canvas || !ctx) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const width = Math.round(window.innerWidth * dpr);
        const height = Math.round(window.innerHeight * dpr);

        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }

        if (currentFrame >= 0) {
            drawFrame(currentFrame);
        }
    }

    // =========================================
    // 5. DRAW ANIMATION FRAME (COVER MODE)
    // =========================================

    function drawFrame(index) {
        if (!canvas || !ctx) return;

        const image = frames[index];

        if (!image || !image.complete || image.naturalWidth === 0) {
            // If requested frame has not loaded yet, use the closest loaded frame
            const fallback = findLoadedFrame(index);
            if (fallback === -1) return;
            drawFrame(fallback);
            return;
        }

        const vw = window.innerWidth;
        const vh = window.innerHeight;
        if (vw === 0 || vh === 0) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const width = Math.round(vw * dpr);
        const height = Math.round(vh * dpr);

        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, vw, vh);

        // Aspect-ratio cover calculation
        const scale = Math.max(
            vw / image.naturalWidth,
            vh / image.naturalHeight
        );

        const drawWidth = image.naturalWidth * scale;
        const drawHeight = image.naturalHeight * scale;

        const x = (vw - drawWidth) / 2;
        const y = (vh - drawHeight) / 2;

        ctx.drawImage(image, x, y, drawWidth, drawHeight);

        currentFrame = index;

        // Update frame counter (1-indexed display: 01 - 60)
        if (currentLabel) {
            currentLabel.textContent = String(index + 1).padStart(2, "0");
        }

        // Update progress bar
        if (progressBar) {
            progressBar.style.width = `${((index + 1) / FRAME_COUNT) * 100}%`;
        }
    }

    // =========================================
    // 6. FIND NEAREST LOADED FRAME
    // =========================================

    function findLoadedFrame(targetIndex) {
        for (let distance = 0; distance < FRAME_COUNT; distance++) {
            const forward = targetIndex + distance;
            if (
                forward < FRAME_COUNT &&
                frames[forward] &&
                frames[forward].complete &&
                frames[forward].naturalWidth > 0
            ) {
                return forward;
            }

            const backward = targetIndex - distance;
            if (
                backward >= 0 &&
                frames[backward] &&
                frames[backward].complete &&
                frames[backward].naturalWidth > 0
            ) {
                return backward;
            }
        }
        return -1;
    }

    // =========================================
    // 7. UPDATE ANIMATION ACROSS FULL DOCUMENT SCROLL
    // =========================================

    function updateAnimation() {
        ticking = false;

        if (!canvas || !ctx || !animationReady) return;

        const scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
        const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);

        // Calculate progress across entire page from top (Hero) to bottom (Footer)
        let progress = scrollY / maxScroll;
        progress = Math.max(0, Math.min(1, progress));

        // Map smoothly to all 60 frames (0 to 59)
        const targetFrame = Math.round(progress * (FRAME_COUNT - 1));

        if (targetFrame !== currentFrame) {
            drawFrame(targetFrame);
        }
    }

    // =========================================
    // 8. SCROLL PERFORMANCE WITH rAF
    // =========================================

    function requestAnimationUpdate() {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(updateAnimation);
    }

    window.addEventListener("scroll", requestAnimationUpdate, { passive: true });

    window.addEventListener("resize", () => {
        resizeCanvas();
        requestAnimationUpdate();
    });

    window.addEventListener("orientationchange", () => {
        setTimeout(() => {
            resizeCanvas();
            requestAnimationUpdate();
        }, 120);
    });

    // =========================================
    // 9. MOBILE NAVIGATION
    // =========================================

    const menuToggle = document.querySelector(".menu-toggle, .nav-toggle, #menu-toggle");
    const navLinks = document.querySelector(".nav-links, #nav-links");

    if (menuToggle && navLinks) {
        menuToggle.addEventListener("click", () => {
            const isOpen = navLinks.classList.toggle("open");
            navLinks.classList.toggle("active", isOpen);
            menuToggle.classList.toggle("active", isOpen);
            menuToggle.setAttribute("aria-expanded", String(isOpen));
        });

        navLinks.querySelectorAll("a").forEach((link) => {
            link.addEventListener("click", () => {
                navLinks.classList.remove("open", "active");
                menuToggle.classList.remove("active");
                menuToggle.setAttribute("aria-expanded", "false");
            });
        });
    }

    // =========================================
    // 10. SCROLL REVEAL ANIMATIONS
    // =========================================

    const revealElements = document.querySelectorAll(".reveal, .reveal-up, .fade-in, [data-reveal]");

    if ("IntersectionObserver" in window) {
        const revealObserver = new IntersectionObserver(
            (entries, observer) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("is-visible", "visible", "revealed");
                        observer.unobserve(entry.target);
                    }
                });
            },
            {
                threshold: 0.12,
                rootMargin: "0px 0px -40px 0px"
            }
        );

        revealElements.forEach((element) => {
            revealObserver.observe(element);
        });
    } else {
        revealElements.forEach((element) => {
            element.classList.add("is-visible", "visible", "revealed");
        });
    }

    // =========================================
    // 11. GALLERY LIGHTBOX
    // =========================================

    const lightbox = document.getElementById("lightbox") || document.getElementById("gallery-lightbox");
    const lightboxImage = document.getElementById("lightbox-image");
    const lightboxCaption = document.getElementById("lightbox-caption");
    const lightboxClose = document.getElementById("lightbox-close");
    const lightboxPrev = document.getElementById("lightbox-prev");
    const lightboxNext = document.getElementById("lightbox-next");

    const galleryButtons = Array.from(document.querySelectorAll(".gallery-item, [data-image]"));
    let currentGalleryIndex = 0;

    function openLightbox(index) {
        if (!lightbox || galleryButtons.length === 0) return;

        currentGalleryIndex = (index + galleryButtons.length) % galleryButtons.length;
        const btn = galleryButtons[currentGalleryIndex];
        const img = btn.querySelector("img");

        const src = btn.getAttribute("data-image") || (img ? img.getAttribute("src") : "");
        const caption = btn.getAttribute("data-caption") || (img ? img.getAttribute("alt") : "Everora Estate");

        if (lightboxImage) {
            lightboxImage.src = src;
            lightboxImage.alt = caption;
        }

        if (lightboxCaption) {
            lightboxCaption.textContent = caption;
        }

        lightbox.classList.add("open", "active", "is-active");
        lightbox.setAttribute("aria-hidden", "false");
        document.body.classList.add("no-scroll", "lightbox-open");
    }

    function closeLightbox() {
        if (!lightbox) return;
        lightbox.classList.remove("open", "active", "is-active");
        lightbox.setAttribute("aria-hidden", "true");
        document.body.classList.remove("no-scroll", "lightbox-open");
    }

    function navigateLightbox(step) {
        openLightbox(currentGalleryIndex + step);
    }

    galleryButtons.forEach((btn, idx) => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            openLightbox(idx);
        });
    });

    if (lightboxClose) {
        lightboxClose.addEventListener("click", closeLightbox);
    }

    if (lightboxPrev) {
        lightboxPrev.addEventListener("click", (e) => {
            e.stopPropagation();
            navigateLightbox(-1);
        });
    }

    if (lightboxNext) {
        lightboxNext.addEventListener("click", (e) => {
            e.stopPropagation();
            navigateLightbox(1);
        });
    }

    if (lightbox) {
        lightbox.addEventListener("click", (e) => {
            if (e.target === lightbox || e.target.tagName === "FIGURE") {
                closeLightbox();
            }
        });
    }

    document.addEventListener("keydown", (e) => {
        if (!lightbox || !lightbox.classList.contains("open")) return;
        if (e.key === "Escape") closeLightbox();
        if (e.key === "ArrowLeft") navigateLightbox(-1);
        if (e.key === "ArrowRight") navigateLightbox(1);
    });
    // =========================================
    // 12. ENQUIRY FORM - POST TO FLASK API
    // =========================================

    const enquiryForm = document.querySelector(
        "#enquiry-form, .enquiry-form, form[data-enquiry]"
    );

    if (enquiryForm) {
        enquiryForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            if (!enquiryForm.checkValidity()) {
                enquiryForm.reportValidity();
                return;
            }

            const submitButton = enquiryForm.querySelector(
                'button[type="submit"], input[type="submit"]'
            );

            const originalText = submitButton
                ? (
                    submitButton.tagName === "INPUT"
                        ? submitButton.value
                        : submitButton.innerHTML
                )
                : "";

            let message = enquiryForm.querySelector(".form-message");

            if (!message) {
                message = document.createElement("p");
                message.className = "form-message";
                message.setAttribute("role", "status");
                message.style.cssText =
                    "color: var(--gold); font-size: 11px; margin-top: 10px;";
                enquiryForm.appendChild(message);
            }

            const setButtonText = (text) => {
                if (!submitButton) return;

                if (submitButton.tagName === "INPUT") {
                    submitButton.value = text;
                } else {
                    submitButton.textContent = text;
                }
            };

            if (submitButton) {
                submitButton.disabled = true;
                setButtonText("Sending...");
            }

            message.textContent = "Submitting your enquiry...";

            try {
                const formData = new FormData(enquiryForm);

                const guestsValue = formData.get("guests");

                const enquiry = {
                    name: String(formData.get("name") || "").trim(),
                    email: String(formData.get("email") || "").trim(),
                    event: String(formData.get("event") || "").trim(),
                    guests: guestsValue
                        ? Number(guestsValue)
                        : null,
                    message: String(formData.get("message") || "").trim()
                };

                const response = await fetch(
                    "http://127.0.0.1:5000/api/enquiries",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify(enquiry)
                    }
                );

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(
                        result.message || "Unable to submit your enquiry."
                    );
                }

                message.textContent =
                    "Thank you! Your enquiry has been received.";

                enquiryForm.reset();

                setButtonText("Thank you!");

            } catch (error) {
                console.error("Everora enquiry submission failed:", error);

                message.textContent =
                    error instanceof TypeError
                        ? "Could not connect to the server. Please try again."
                        : error.message ||
                          "Something went wrong. Please try again.";

            } finally {
                if (submitButton) {
                    window.setTimeout(() => {
                        submitButton.innerHTML = originalText;

                        if (submitButton.tagName === "INPUT") {
                            submitButton.value = originalText;
                        }

                        submitButton.disabled = false;
                    }, 2500);
                }
            }
        });
    }

    // =========================================
    // 13. AUTOMATIC FOOTER YEAR
    // =========================================

    const footerYear = document.getElementById("year") || document.getElementById("current-year");
    if (footerYear) {
        footerYear.textContent = new Date().getFullYear();
    }

    // =========================================
    // 14. INITIALIZE ANIMATION
    // =========================================

    loadFrames();

    console.info("Everora: JavaScript initialized.");
});