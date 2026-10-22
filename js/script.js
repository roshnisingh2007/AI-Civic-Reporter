document.addEventListener("DOMContentLoaded", function () {

    const API_BASE = ""; // Relative path to Python backend

    // Helper: Safely display user-entered text in HTML
    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, function (char) {
            return {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            }[char];
        });
    }

    // Helper: Show floating toast notification
    function showToast(message, isError = false) {
        let toast = document.getElementById("toastNotice");
        if (!toast) {
            toast = document.createElement("div");
            toast.id = "toastNotice";
            toast.className = "toast-notice";
            document.body.appendChild(toast);
        }
        toast.style.background = isError ? "#b91c1c" : "#0f172a";
        toast.innerHTML = `<span>${isError ? "⚠️" : "✓"}</span> <span>${escapeHTML(message)}</span>`;
        toast.style.display = "flex";

        setTimeout(function () {
            toast.style.display = "none";
        }, 3200);
    }

    /* ========================================================
       1. AI ANALYSIS PREVIEW (Client-side & Python Heuristic)
       ======================================================== */
    const categoryInput = document.getElementById("category");
    const descriptionInput = document.getElementById("description");
    const analysisPreview = document.getElementById("aiAnalysisPreview");
    const suggestedCategory = document.getElementById("suggestedCategory");
    const suggestedPriority = document.getElementById("suggestedPriority");

    function updateAIAnalysis() {
        if (!categoryInput || !descriptionInput || !analysisPreview) return;

        const category = categoryInput.value;
        const description = descriptionInput.value.toLowerCase().trim();

        if (!category || !description) {
            analysisPreview.style.display = "none";
            return;
        }

        let priority = "Medium";
        const urgentWords = [
            "danger", "emergency", "accident", "overflow", "severe", "broken",
            "leak", "hazard", "fire", "electric", "wire", "shock", "collapse",
            "deep", "sinkhole", "toxic", "injury", "flood", "caved", "urgent"
        ];
        const lowWords = ["minor", "dust", "flicker", "paint", "cleaning", "small"];

        if (urgentWords.some(word => description.includes(word))) {
            priority = "High";
        } else if (lowWords.some(word => description.includes(word)) || description.length < 15) {
            priority = "Low";
        }

        suggestedCategory.textContent = category;
        suggestedPriority.textContent = priority;
        suggestedPriority.style.color = priority === "High" ? "#dc2626" : (priority === "Medium" ? "#d97706" : "#16a34a");
        analysisPreview.style.display = "block";
    }

    if (categoryInput && descriptionInput) {
        categoryInput.addEventListener("change", updateAIAnalysis);
        descriptionInput.addEventListener("input", updateAIAnalysis);
    }

    /* ========================================================
       2. STRICT LIVE CAMERA ONLY SYSTEM (ANTI-FAKE VERIFICATION)
       ======================================================== */
    const startLiveCameraBtn = document.getElementById("startLiveCameraBtn");
    const mobileCameraBtn = document.getElementById("mobileCameraBtn");
    const mobileCameraInput = document.getElementById("mobileCameraInput");
    const cameraControls = document.getElementById("cameraControls");
    const cameraViewfinder = document.getElementById("cameraViewfinder");
    const cameraVideo = document.getElementById("cameraVideo");
    const snapPhotoBtn = document.getElementById("snapPhotoBtn");
    const stopCameraBtn = document.getElementById("stopCameraBtn");
    const retakePhotoBtn = document.getElementById("retakePhotoBtn");
    const geotagCanvas = document.getElementById("geotagCanvas");
    const imagePreview = document.getElementById("imagePreview");
    const previewContainer = document.getElementById("imagePreviewContainer");
    const liveStatusBadge = document.getElementById("liveStatusBadge");
    const geotagMessageBox = document.getElementById("geotagMessageBox");
    const geoOverlayCoords = document.getElementById("geoOverlayCoords");
    const geoOverlayTime = document.getElementById("geoOverlayTime");
    const geotagLatInput = document.getElementById("geotagLat");
    const geotagLngInput = document.getElementById("geotagLng");
    const locationInput = document.getElementById("location");

    let liveCapturedFile = null;
    let isLiveVerified = false;
    let mediaStream = null;

    async function startCamera() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            if (mobileCameraInput) mobileCameraInput.click();
            return;
        }

        try {
            if (startLiveCameraBtn) {
                startLiveCameraBtn.disabled = true;
                startLiveCameraBtn.textContent = "Connecting Camera...";
            }

            mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: "environment",
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            });

            if (cameraVideo) {
                cameraVideo.srcObject = mediaStream;
                cameraVideo.play();
            }

            if (cameraViewfinder) cameraViewfinder.style.display = "block";
            if (cameraControls) cameraControls.style.display = "none";
            if (previewContainer) previewContainer.style.display = "none";
        } catch (err) {
            console.error("Camera access error:", err);
            alert("Could not access live camera. Please check camera permissions in your browser, or tap 'Mobile Camera App'.");
            if (cameraControls) cameraControls.style.display = "block";
        } finally {
            if (startLiveCameraBtn) {
                startLiveCameraBtn.disabled = false;
                startLiveCameraBtn.textContent = "📷 Open Live Camera";
            }
        }
    }

    function stopCamera() {
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
            mediaStream = null;
        }
        if (cameraViewfinder) cameraViewfinder.style.display = "none";
        if (cameraControls) cameraControls.style.display = "block";
    }

    if (startLiveCameraBtn) startLiveCameraBtn.addEventListener("click", startCamera);
    if (stopCameraBtn) stopCameraBtn.addEventListener("click", stopCamera);

    if (mobileCameraBtn && mobileCameraInput) {
        mobileCameraBtn.addEventListener("click", () => mobileCameraInput.click());

        mobileCameraInput.addEventListener("change", function () {
            const file = mobileCameraInput.files[0];
            if (!file) return;

            const imgObj = new Image();
            imgObj.onload = function () {
                fetchLocationAndStamp(imgObj);
            };
            imgObj.src = URL.createObjectURL(file);
        });
    }

    if (snapPhotoBtn) {
        snapPhotoBtn.addEventListener("click", function () {
            if (!cameraVideo || !cameraVideo.videoWidth) {
                alert("Camera feed is not ready yet. Please wait a moment.");
                return;
            }
            fetchLocationAndStamp(cameraVideo);
        });
    }

    function fetchLocationAndStamp(sourceMedia) {
        const snapBtn = snapPhotoBtn;
        if (snapBtn) {
            snapBtn.disabled = true;
            snapBtn.textContent = "📍 Verifying GPS & Stamping Live Photo...";
        }

        if (!navigator.geolocation) {
            alert("Geolocation is required to take a live verified photo. Please enable location on your device.");
            if (snapBtn) {
                snapBtn.disabled = false;
                snapBtn.textContent = "📸 Click Live Picture & Geotag";
            }
            return;
        }

        navigator.geolocation.getCurrentPosition(
            function (position) {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const accuracy = Math.round(position.coords.accuracy || 8);

                stampLivePhotoOnCanvas(sourceMedia, lat, lng, accuracy, function (geotaggedBlob) {
                    liveCapturedFile = new File([geotaggedBlob], `live_capture_${Date.now()}.jpg`, { type: "image/jpeg" });
                    isLiveVerified = true;

                    const latFixed = Number(lat).toFixed(5);
                    const lngFixed = Number(lng).toFixed(5);
                    if (geotagLatInput) geotagLatInput.value = latFixed;
                    if (geotagLngInput) geotagLngInput.value = lngFixed;

                    if (imagePreview) imagePreview.src = URL.createObjectURL(liveCapturedFile);
                    if (previewContainer) previewContainer.style.display = "block";

                    const dateFormatted = new Date().toLocaleString();
                    if (geoOverlayCoords) geoOverlayCoords.innerHTML = `📍 GPS: ${latFixed}° N, ${lngFixed}° E (±${accuracy}m)`;
                    if (geoOverlayTime) geoOverlayTime.innerHTML = `🕒 LIVE TIMESTAMP: ${dateFormatted} [VERIFIED]`;

                    if (liveStatusBadge) {
                        liveStatusBadge.style.background = "#ecfdf5";
                        liveStatusBadge.style.color = "#047857";
                        liveStatusBadge.style.borderColor = "#a7f3d0";
                        liveStatusBadge.innerHTML = `✅ Live On-Site Photo Verified`;
                    }

                    if (geotagMessageBox) {
                        geotagMessageBox.style.display = "block";
                        geotagMessageBox.style.background = "#f0fdf4";
                        geotagMessageBox.style.color = "#166534";
                        geotagMessageBox.style.border = "1px solid #bbf7d0";
                        geotagMessageBox.innerHTML = `<strong>✅ Live Verification Successful:</strong> Camera photo snapped on location at Lat ${latFixed}, Lng ${lngFixed}. Anti-fake report verification passed!`;
                    }

                    if (locationInput) {
                        locationInput.value = `${latFixed}, ${lngFixed} (📍 Live On-Site Capture)`;
                    }

                    stopCamera();

                    if (snapBtn) {
                        snapBtn.disabled = false;
                        snapBtn.textContent = "📸 Click Live Picture & Geotag";
                    }
                });
            },
            function (err) {
                console.error("GPS error:", err);
                alert("GPS Location access is mandatory to take a live verified photo.\n\nPlease allow browser location permissions and try again.");
                if (snapBtn) {
                    snapBtn.disabled = false;
                    snapBtn.textContent = "📸 Click Live Picture & Geotag";
                }
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    }

    function stampLivePhotoOnCanvas(sourceMedia, lat, lng, accuracy, callback) {
        const canvas = geotagCanvas || document.createElement("canvas");
        const maxDim = 1280;

        let srcW = sourceMedia.videoWidth || sourceMedia.width;
        let srcH = sourceMedia.videoHeight || sourceMedia.height;

        let w = srcW;
        let h = srcH;

        if (w > maxDim || h > maxDim) {
            if (w > h) {
                h = Math.round((h * maxDim) / w);
                w = maxDim;
            } else {
                w = Math.round((w * maxDim) / h);
                h = maxDim;
            }
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");

        ctx.drawImage(sourceMedia, 0, 0, w, h);

        const bannerHeight = Math.max(64, Math.round(h * 0.14));
        ctx.fillStyle = "rgba(15, 23, 42, 0.90)";
        ctx.fillRect(0, h - bannerHeight, w, bannerHeight);

        ctx.fillStyle = "#dc2626";
        ctx.fillRect(0, h - bannerHeight, w, 4);

        const fontSize = Math.max(13, Math.round(bannerHeight * 0.28));
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillText(`🛡️ AI CIVIC REPORTER | LIVE ON-SITE CAPTURE`, 16, h - bannerHeight + fontSize + 6);

        const latFixed = Number(lat).toFixed(5);
        const lngFixed = Number(lng).toFixed(5);
        const dateStr = new Date().toISOString().replace("T", " ").substring(0, 19);

        ctx.fillStyle = "#94a3b8";
        ctx.font = `${Math.max(11, Math.round(fontSize * 0.82))}px monospace`;
        ctx.fillText(`LAT: ${latFixed}° N | LNG: ${lngFixed}° E | ACC: ±${accuracy}m | ${dateStr} UTC (LIVE)`, 16, h - 14);

        canvas.toBlob(callback, "image/jpeg", 0.92);
    }

    if (retakePhotoBtn) {
        retakePhotoBtn.addEventListener("click", function () {
            liveCapturedFile = null;
            isLiveVerified = false;
            if (geotagLatInput) geotagLatInput.value = "";
            if (geotagLngInput) geotagLngInput.value = "";
            if (previewContainer) previewContainer.style.display = "none";
            if (geotagMessageBox) geotagMessageBox.style.display = "none";

            if (liveStatusBadge) {
                liveStatusBadge.style.background = "#fee2e2";
                liveStatusBadge.style.color = "#b91c1c";
                liveStatusBadge.innerHTML = "🔴 Live Photo Required";
            }

            startCamera();
        });
    }

    const locationButton = document.getElementById("getLocationBtn");
    if (locationButton) {
        locationButton.addEventListener("click", function () {
            const locInput = document.getElementById("location");
            const message = document.getElementById("locationMessage");

            if (!navigator.geolocation) {
                if (message) message.textContent = "Geolocation is not supported by your browser.";
                return;
            }

            if (message) message.textContent = "Refreshing coordinates...";

            navigator.geolocation.getCurrentPosition(
                function (position) {
                    const lat = position.coords.latitude.toFixed(5);
                    const lng = position.coords.longitude.toFixed(5);
                    locInput.value = `${lat}, ${lng} (📍 GPS Refreshed)`;
                    if (message) message.textContent = "📍 Coordinates refreshed successfully!";
                },
                function () {
                    if (message) message.textContent = "Location unavailable. Please allow browser location access.";
                }
            );
        });
    }

    /* ========================================================
       3. SUBMIT COMPLAINT (Strict Anti-Fake Live Photo Only)
       ======================================================== */
    const complaintForm = document.getElementById("complaintForm");
    if (complaintForm) {
        complaintForm.addEventListener("submit", async function (event) {
            event.preventDefault();

            const submitBtn = document.getElementById("submitComplaintBtn") || complaintForm.querySelector("button[type='submit']");
            const origText = submitBtn ? submitBtn.textContent : "Submit Verified Complaint";

            const name = document.getElementById("name").value.trim();
            const category = document.getElementById("category").value;
            const description = document.getElementById("description").value.trim();
            const location = document.getElementById("location").value.trim();

            if (!name || !category || !description || !location) {
                alert("Please fill in all required fields.");
                return;
            }

            if (!isLiveVerified || !liveCapturedFile) {
                alert(
                    "❌ LIVE CAMERA PHOTO REQUIRED!\n\n" +
                    "To prevent fake reports, this platform strictly accepts only real-time LIVE camera pictures taken on-site.\n\n" +
                    "👉 Click '📷 Open Live Camera' to take a verified live picture of the issue."
                );
                if (cameraControls) {
                    cameraControls.scrollIntoView({ behavior: "smooth", block: "center" });
                }
                return;
            }

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = "Verifying Live Capture & Submitting...";
            }

            function handleSuccess(complaintID, latVal, lngVal) {
                alert(
                    `🎉 Complaint Submitted Successfully!\n\n` +
                    `Complaint ID: ${complaintID}\n` +
                    `Live Photo Verified: Lat ${latVal}, Lng ${lngVal}\n\n` +
                    `Your issue is marked as 'Live Verified' on the Admin Dashboard.`
                );

                complaintForm.reset();
                liveCapturedFile = null;
                isLiveVerified = false;
                if (previewContainer) previewContainer.style.display = "none";
                if (geotagMessageBox) geotagMessageBox.style.display = "none";
                if (liveStatusBadge) {
                    liveStatusBadge.style.background = "#fee2e2";
                    liveStatusBadge.style.color = "#b91c1c";
                    liveStatusBadge.innerHTML = "🔴 Live Photo Required";
                }

                if (confirm(`Would you like to track complaint #${complaintID} now?`)) {
                    window.location.href = `track.html?id=${complaintID}`;
                }
            }

            try {
                const formData = new FormData();
                formData.append("name", name);
                formData.append("category", category);
                formData.append("description", description);
                formData.append("location", location);
                formData.append("image", liveCapturedFile, liveCapturedFile.name || "live_capture.jpg");

                if (geotagLatInput && geotagLatInput.value) {
                    formData.append("geotag_lat", geotagLatInput.value);
                }
                if (geotagLngInput && geotagLngInput.value) {
                    formData.append("geotag_lng", geotagLngInput.value);
                }
                formData.append("is_live_capture", "true");

                let apiSuccess = false;
                let apiResult = null;

                try {
                    const response = await fetch(`${API_BASE}/api/complaints`, {
                        method: "POST",
                        body: formData
                    });
                    if (response.ok) {
                        apiResult = await response.json();
                        apiSuccess = true;
                    }
                } catch (netErr) {
                    console.log("Server API not reachable, saving to local hybrid storage:", netErr);
                }

                if (apiSuccess && apiResult) {
                    handleSuccess(apiResult.complaint_id, apiResult.geotag?.latitude, apiResult.geotag?.longitude);
                } else {
                    // Hybrid Fallback for GitHub Pages / Static Hosting
                    const reader = new FileReader();
                    reader.onload = function () {
                        const dataUrl = reader.result;
                        const newId = "CR" + Math.floor(1000 + Math.random() * 9000);
                        const newRec = {
                            id: newId,
                            name: name,
                            category: category,
                            description: description,
                            location: location,
                            priority: suggestedPriority ? suggestedPriority.textContent : "Medium",
                            status: "Pending",
                            image_url: dataUrl,
                            geotag_lat: geotagLatInput.value || "28.6139",
                            geotag_lng: geotagLngInput.value || "77.2090",
                            created_at: new Date().toISOString().replace("T", " ").substring(0, 19)
                        };

                        const localList = JSON.parse(localStorage.getItem("civic_complaints")) || [];
                        localList.unshift(newRec);
                        localStorage.setItem("civic_complaints", JSON.stringify(localList));

                        handleSuccess(newId, newRec.geotag_lat, newRec.geotag_lng);
                    };
                    reader.readAsDataURL(liveCapturedFile);
                }
            } catch (err) {
                console.error("Submission error:", err);
                alert("Submission error. Please try again.");
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = origText;
                }
            }
        });
    }

    /* ========================================================
       4. TRACK COMPLAINT (Hybrid Backend + Local Fallback)
       ======================================================== */
    const trackForm = document.getElementById("trackForm");
    if (trackForm) {
        const urlParams = new URLSearchParams(window.location.search);
        const queryId = urlParams.get("id");
        if (queryId) {
            const input = document.getElementById("complaintID");
            if (input) {
                input.value = queryId;
                setTimeout(() => trackComplaint(queryId), 100);
            }
        }

        trackForm.addEventListener("submit", function (event) {
            event.preventDefault();
            const enteredID = document.getElementById("complaintID").value.trim().toUpperCase();
            trackComplaint(enteredID);
        });

        async function trackComplaint(complaintID) {
            const resultBox = document.getElementById("complaintResult");
            if (!resultBox) return;

            resultBox.innerHTML = `
                <div class="status-card" style="text-align:center; padding: 25px;">
                    <p>Fetching complaint status...</p>
                </div>
            `;

            let item = null;

            // 1. Try server API
            try {
                const response = await fetch(`${API_BASE}/api/complaints/${encodeURIComponent(complaintID)}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.success) item = data.complaint;
                }
            } catch (e) { }

            // 2. Try localStorage fallback for GitHub Pages
            if (!item) {
                const localList = JSON.parse(localStorage.getItem("civic_complaints")) || [];
                item = localList.find(c => c.id.toUpperCase() === complaintID.toUpperCase());
            }

            if (!item) {
                resultBox.innerHTML = `
                    <div class="status-card" style="border-left: 4px solid #ef4444; padding: 25px;">
                        <h2 style="color: #ef4444;">Complaint Not Found</h2>
                        <p>No civic issue found with ID <strong>${escapeHTML(complaintID)}</strong>.</p>
                        <p style="font-size: 14px; color: #64748b; margin-top: 8px;">Please verify your Complaint ID (e.g., CR1001) or check the Admin Dashboard.</p>
                    </div>
                `;
                return;
            }

            const status = item.status || "Pending";
            const priority = item.priority || "Medium";

            const isStep1 = true;
            const isStep2 = status === "In Progress" || status === "Resolved";
            const isStep3 = status === "Resolved";

            let priorityClass = "badge-priority-medium";
            if (priority === "High") priorityClass = "badge-priority-high";
            if (priority === "Low") priorityClass = "badge-priority-low";

            let geotagBadge = "";
            if (item.geotag_lat && item.geotag_lng) {
                geotagBadge = `<span style="font-size: 12px; font-weight: 700; background: #dcfce7; color: #15803d; padding: 3px 8px; border-radius: 6px; margin-left: 6px;">🛡️ Live GPS: ${item.geotag_lat}, ${item.geotag_lng}</span>`;
            }

            let imageHtml = "";
            if (item.image_url) {
                imageHtml = `
                    <div style="margin-top: 15px;">
                        <strong>Attached Live Photo:</strong><br>
                        <a href="${item.image_url}" target="_blank">
                            <img src="${item.image_url}" alt="Complaint Photo" style="max-width: 280px; max-height: 200px; border-radius: 8px; margin-top: 8px; border: 1px solid #cbd5e1; object-fit: cover;">
                        </a>
                    </div>
                `;
            }

            resultBox.innerHTML = `
                <div class="status-card" style="background: white; padding: 28px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.08); margin-top: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 15px;">
                        <div>
                            <span class="badge-id" style="font-size: 16px;">#${escapeHTML(item.id)}</span>
                            <span class="category-tag" style="margin-left: 8px;">${escapeHTML(item.category)}</span>
                            <span class="badge-priority ${priorityClass}" style="margin-left: 6px;">${escapeHTML(priority)} Priority</span>
                            ${geotagBadge}
                        </div>
                        <div>
                            <strong style="font-size: 15px; color: #173f5f;">Status:</strong> 
                            <span class="complaint-status" style="font-weight: 700; font-size: 15px;">${escapeHTML(status)}</span>
                        </div>
                    </div>

                    <div class="tracking-stepper">
                        <div class="tracking-step ${isStep1 ? (isStep2 ? 'step-done' : 'step-active') : ''}">
                            <div class="step-circle">${isStep2 ? '✓' : '1'}</div>
                            <div class="step-title">1. Reported</div>
                        </div>
                        <div class="tracking-step ${isStep2 ? (isStep3 ? 'step-done' : 'step-active') : ''}">
                            <div class="step-circle">${isStep3 ? '✓' : '2'}</div>
                            <div class="step-title">2. In Progress</div>
                        </div>
                        <div class="tracking-step ${isStep3 ? 'step-done' : ''}">
                            <div class="step-circle">${isStep3 ? '✓' : '3'}</div>
                            <div class="step-title">3. Resolved</div>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px; margin-top: 15px;">
                        <div>
                            <p style="margin: 0; font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase;">Citizen Name</p>
                            <p style="margin: 3px 0 0; font-size: 15px; color: #1e293b; font-weight: 600;">${escapeHTML(item.name)}</p>
                        </div>
                        <div>
                            <p style="margin: 0; font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase;">Location</p>
                            <p style="margin: 3px 0 0; font-size: 15px; color: #1e293b;">📍 ${escapeHTML(item.location)}</p>
                        </div>
                        <div>
                            <p style="margin: 0; font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase;">Date Submitted</p>
                            <p style="margin: 3px 0 0; font-size: 15px; color: #1e293b;">${escapeHTML(item.created_at || 'Recently')}</p>
                        </div>
                    </div>

                    <div style="margin-top: 18px; padding-top: 15px; border-top: 1px solid #f1f5f9;">
                        <p style="margin: 0; font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase;">Description</p>
                        <p style="margin: 6px 0 0; font-size: 15px; color: #334155; line-height: 1.6;">${escapeHTML(item.description)}</p>
                    </div>

                    ${imageHtml}
                </div>
            `;
        }
    }

    /* ========================================================
       5. ADMIN DASHBOARD (Hybrid Server + Local Fallback)
       ======================================================== */
    const complaintTableBody = document.getElementById("complaintTableBody");

    if (complaintTableBody) {
        let allComplaints = [];

        async function loadAdminDashboard() {
            const recordsBadge = document.getElementById("recordsCountBadge");
            if (recordsBadge) recordsBadge.textContent = "Updating...";

            let loadedFromServer = false;

            try {
                const statsRes = await fetch(`${API_BASE}/api/stats`);
                if (statsRes.ok) {
                    const stats = await statsRes.json();
                    document.getElementById("totalComplaints").textContent = stats.total || 0;
                    document.getElementById("pendingComplaints").textContent = stats.pending || 0;
                    const inProgEl = document.getElementById("inProgressComplaints");
                    if (inProgEl) inProgEl.textContent = stats.in_progress || 0;
                    document.getElementById("resolvedComplaints").textContent = stats.resolved || 0;
                }

                const compRes = await fetch(`${API_BASE}/api/complaints`);
                if (compRes.ok) {
                    const data = await compRes.json();
                    allComplaints = data.complaints || [];
                    loadedFromServer = true;
                }
            } catch (err) { }

            // If not loaded from server API (e.g. running on static GitHub Pages)
            if (!loadedFromServer) {
                const localList = JSON.parse(localStorage.getItem("civic_complaints")) || [
                    {
                        id: "CR1001",
                        name: "Rajesh Sharma",
                        category: "Pothole",
                        description: "Dangerous pothole near Sector 14 roundabout.",
                        location: "Sector 14 Main Road (📍 28.6139, 77.2090)",
                        priority: "High",
                        status: "Pending",
                        image_url: null,
                        geotag_lat: 28.6139,
                        geotag_lng: 77.2090,
                        created_at: "2026-10-22 14:30:00"
                    },
                    {
                        id: "CR1002",
                        name: "Priya Verma",
                        category: "Garbage",
                        description: "Overflowing garbage dump near community park.",
                        location: "Green Park Gate 2 (📍 28.5583, 77.2024)",
                        priority: "Medium",
                        status: "In Progress",
                        image_url: null,
                        geotag_lat: 28.5583,
                        geotag_lng: 77.2024,
                        created_at: "2026-10-21 11:20:00"
                    }
                ];

                allComplaints = localList;

                const total = allComplaints.length;
                const pending = allComplaints.filter(c => c.status === "Pending").length;
                const inProg = allComplaints.filter(c => c.status === "In Progress").length;
                const resolved = allComplaints.filter(c => c.status === "Resolved").length;

                document.getElementById("totalComplaints").textContent = total;
                document.getElementById("pendingComplaints").textContent = pending;
                const inProgEl = document.getElementById("inProgressComplaints");
                if (inProgEl) inProgEl.textContent = inProg;
                document.getElementById("resolvedComplaints").textContent = resolved;
            }

            renderAdminTable();
        }

        function renderAdminTable() {
            const searchVal = (document.getElementById("adminSearchInput")?.value || "").toLowerCase().trim();
            const statusFilter = document.getElementById("filterStatus")?.value || "All";
            const catFilter = document.getElementById("filterCategory")?.value || "All";
            const priorityFilter = document.getElementById("filterPriority")?.value || "All";

            let filtered = allComplaints.filter(item => {
                if (statusFilter !== "All" && item.status !== statusFilter) return false;
                if (catFilter !== "All" && item.category !== catFilter) return false;
                if (priorityFilter !== "All" && item.priority !== priorityFilter) return false;

                if (searchVal) {
                    const haystack = `${item.id} ${item.name} ${item.location} ${item.description} ${item.category}`.toLowerCase();
                    if (!haystack.includes(searchVal)) return false;
                }
                return true;
            });

            const recordsBadge = document.getElementById("recordsCountBadge");
            if (recordsBadge) {
                recordsBadge.textContent = `Showing ${filtered.length} of ${allComplaints.length} complaints`;
            }

            if (filtered.length === 0) {
                complaintTableBody.innerHTML = `
                    <tr>
                        <td colspan="9" style="text-align: center; padding: 40px; color: #64748b;">
                            <div style="font-size: 28px; margin-bottom: 8px;">📭</div>
                            <strong>No complaints found.</strong><br>
                            <span style="font-size: 13px;">No problem reports match the selected filters or search keyword.</span>
                        </td>
                    </tr>
                `;
                return;
            }

            complaintTableBody.innerHTML = "";

            filtered.forEach(complaint => {
                const tr = document.createElement("tr");

                let prioClass = "badge-priority-medium";
                if (complaint.priority === "High") prioClass = "badge-priority-high";
                if (complaint.priority === "Low") prioClass = "badge-priority-low";

                let statusClass = "status-pending";
                if (complaint.status === "In Progress") statusClass = "status-inprogress";
                if (complaint.status === "Resolved") statusClass = "status-resolved";

                let photoHtml = '<span class="no-photo">None</span>';
                if (complaint.image_url) {
                    photoHtml = `
                        <div style="display:flex; flex-direction:column; align-items:center; gap:3px;">
                            <a href="${complaint.image_url}" target="_blank" title="Click to view full photo">
                                <img src="${complaint.image_url}" alt="Live issue photo" class="thumb-preview">
                            </a>
                            <span style="font-size:9px; font-weight:700; background:#dcfce7; color:#15803d; border-radius:3px; padding:1px 4px;">🛡️ LIVE PIC</span>
                        </div>
                    `;
                }

                let geotagTag = "";
                if (complaint.geotag_lat && complaint.geotag_lng) {
                    geotagTag = `<br><span style="font-size: 11px; color: #16a34a; font-weight: 700;">📍 ${complaint.geotag_lat}, ${complaint.geotag_lng}</span>`;
                }

                const shortLoc = complaint.location.length > 28 ? complaint.location.substring(0, 28) + "..." : complaint.location;

                tr.innerHTML = `
                    <td><span class="badge-id">#${escapeHTML(complaint.id)}</span></td>
                    <td><strong>${escapeHTML(complaint.name)}</strong></td>
                    <td><span class="category-tag">${escapeHTML(complaint.category)}</span></td>
                    <td title="${escapeHTML(complaint.location)}">📍 ${escapeHTML(shortLoc)} ${geotagTag}</td>
                    <td><span class="badge-priority ${prioClass}">${escapeHTML(complaint.priority || 'Medium')}</span></td>
                    <td>${photoHtml}</td>
                    <td style="font-size: 13px; color: #64748b;">${escapeHTML(complaint.created_at || '-')}</td>
                    <td>
                        <select class="status-select ${statusClass}" data-id="${escapeHTML(complaint.id)}" aria-label="Status for ${escapeHTML(complaint.id)}">
                            <option value="Pending" ${complaint.status === 'Pending' ? 'selected' : ''}>Pending</option>
                            <option value="In Progress" ${complaint.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                            <option value="Resolved" ${complaint.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
                        </select>
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button type="button" class="btn-sm btn-view view-btn" data-id="${escapeHTML(complaint.id)}" title="View full details">
                                👁️ View
                            </button>
                            <button type="button" class="btn-sm btn-delete delete-btn" data-id="${escapeHTML(complaint.id)}" title="Delete complaint">
                                🗑️
                            </button>
                        </div>
                    </td>
                `;

                complaintTableBody.appendChild(tr);
            });
        }

        complaintTableBody.addEventListener("change", async function (event) {
            if (!event.target.matches(".status-select")) return;

            const selectEl = event.target;
            const complaintID = selectEl.dataset.id;
            const newStatus = selectEl.value;

            // Update in local state
            const found = allComplaints.find(c => c.id === complaintID);
            if (found) found.status = newStatus;

            // Update in localStorage
            const localList = JSON.parse(localStorage.getItem("civic_complaints")) || [];
            const locItem = localList.find(c => c.id === complaintID);
            if (locItem) {
                locItem.status = newStatus;
                localStorage.setItem("civic_complaints", JSON.stringify(localList));
            }

            // Also try API
            try {
                await fetch(`${API_BASE}/api/complaints/${encodeURIComponent(complaintID)}/status`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: newStatus })
                });
            } catch (e) { }

            showToast(`Complaint #${complaintID} updated to "${newStatus}"`);
            loadAdminDashboard();
        });

        complaintTableBody.addEventListener("click", async function (event) {
            const viewBtn = event.target.closest(".view-btn");
            if (viewBtn) {
                const complaintID = viewBtn.dataset.id;
                const complaint = allComplaints.find(c => c.id === complaintID);
                if (complaint) openDetailModal(complaint);
                return;
            }

            const deleteBtn = event.target.closest(".delete-btn");
            if (deleteBtn) {
                const complaintID = deleteBtn.dataset.id;
                if (!confirm(`Are you sure you want to delete complaint #${complaintID}?\nThis action cannot be undone.`)) {
                    return;
                }

                allComplaints = allComplaints.filter(c => c.id !== complaintID);

                // Update localStorage
                const localList = JSON.parse(localStorage.getItem("civic_complaints")) || [];
                const updatedList = localList.filter(c => c.id !== complaintID);
                localStorage.setItem("civic_complaints", JSON.stringify(updatedList));

                // Also try API
                try {
                    await fetch(`${API_BASE}/api/complaints/${encodeURIComponent(complaintID)}`, { method: "DELETE" });
                } catch (e) { }

                showToast(`Complaint #${complaintID} deleted successfully`);
                loadAdminDashboard();
            }
        });

        // Detail Modal
        const detailModal = document.getElementById("detailModal");
        const modalCloseBtn = document.getElementById("modalCloseBtn");
        let activeModalComplaintId = null;

        function openDetailModal(c) {
            activeModalComplaintId = c.id;
            document.getElementById("modalIdBadge").textContent = `#${c.id}`;
            document.getElementById("modalCategoryBadge").textContent = c.category;

            const prioEl = document.getElementById("modalPriorityBadge");
            prioEl.textContent = `${c.priority || 'Medium'} Priority`;
            prioEl.className = `badge-priority ${c.priority === 'High' ? 'badge-priority-high' : (c.priority === 'Low' ? 'badge-priority-low' : 'badge-priority-medium')}`;

            document.getElementById("modalCitizenName").textContent = c.name;

            let locText = `📍 ${c.location}`;
            if (c.geotag_lat && c.geotag_lng) {
                locText += `\n[Verified Live Capture: ${c.geotag_lat}, ${c.geotag_lng}]`;
            }
            document.getElementById("modalLocation").textContent = locText;
            document.getElementById("modalDescription").textContent = c.description;
            document.getElementById("modalDate").textContent = c.created_at || 'Recently';

            const photoBox = document.getElementById("modalPhotoContainer");
            if (c.image_url) {
                photoBox.innerHTML = `
                    <div style="margin-bottom: 8px;">
                        <span class="badge-live-verified">🛡️ VERIFIED LIVE ON-SITE PHOTO</span>
                    </div>
                    <a href="${c.image_url}" target="_blank" title="Click to view full photo">
                        <img src="${c.image_url}" alt="Problem photo" class="modal-image">
                    </a>
                `;
            } else {
                photoBox.innerHTML = `<span class="no-photo">No photo uploaded with this report</span>`;
            }

            const modalStatusSelect = document.getElementById("modalStatusSelect");
            if (modalStatusSelect) modalStatusSelect.value = c.status;

            if (detailModal) detailModal.style.display = "flex";
        }

        if (modalCloseBtn && detailModal) {
            modalCloseBtn.addEventListener("click", () => detailModal.style.display = "none");
            detailModal.addEventListener("click", (e) => {
                if (e.target === detailModal) detailModal.style.display = "none";
            });
        }

        const modalStatusSelect = document.getElementById("modalStatusSelect");
        if (modalStatusSelect) {
            modalStatusSelect.addEventListener("change", async function () {
                if (!activeModalComplaintId) return;
                const newStatus = modalStatusSelect.value;

                const found = allComplaints.find(c => c.id === activeModalComplaintId);
                if (found) found.status = newStatus;

                const localList = JSON.parse(localStorage.getItem("civic_complaints")) || [];
                const locItem = localList.find(c => c.id === activeModalComplaintId);
                if (locItem) {
                    locItem.status = newStatus;
                    localStorage.setItem("civic_complaints", JSON.stringify(localList));
                }

                try {
                    await fetch(`${API_BASE}/api/complaints/${encodeURIComponent(activeModalComplaintId)}/status`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ status: newStatus })
                    });
                } catch (e) { }

                showToast(`Status updated to "${newStatus}"`);
                loadAdminDashboard();
            });
        }

        const searchInput = document.getElementById("adminSearchInput");
        if (searchInput) searchInput.addEventListener("input", renderAdminTable);

        const filterStatus = document.getElementById("filterStatus");
        if (filterStatus) filterStatus.addEventListener("change", renderAdminTable);

        const filterCategory = document.getElementById("filterCategory");
        if (filterCategory) filterCategory.addEventListener("change", renderAdminTable);

        const filterPriority = document.getElementById("filterPriority");
        if (filterPriority) filterPriority.addEventListener("change", renderAdminTable);

        const refreshBtn = document.getElementById("refreshBtn");
        if (refreshBtn) {
            refreshBtn.addEventListener("click", function () {
                loadAdminDashboard();
                showToast("Admin data refreshed!");
            });
        }

        loadAdminDashboard();
    }

});
