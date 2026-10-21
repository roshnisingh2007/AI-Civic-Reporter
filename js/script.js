document.addEventListener("DOMContentLoaded", function () {
    
    // AI Analysis Preview - Frontend Demo

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
            "danger", "emergency", "accident", "overflow",
            "severe", "broken", "leak", "hazard"
        ];

        if (urgentWords.some(word => description.includes(word))) {
            priority = "High";
        } else if (description.length < 20) {
            priority = "Low";
        }

        suggestedCategory.textContent = category;
        suggestedPriority.textContent = priority;
        analysisPreview.style.display = "block";
    }

    if (categoryInput && descriptionInput) {
        categoryInput.addEventListener("change", updateAIAnalysis);
        descriptionInput.addEventListener("input", updateAIAnalysis);
    }

    // Complaint Image Preview

    const imageInput = document.getElementById("image");
    const imagePreview = document.getElementById("imagePreview");

    if (imageInput && imagePreview) {
        imageInput.addEventListener("change", function () {
            const file = imageInput.files[0];

            if (file && file.type.startsWith("image/")) {
                imagePreview.src = URL.createObjectURL(file);
                imagePreview.style.display = "block";
            } else {
                imagePreview.removeAttribute("src");
                imagePreview.style.display = "none";
            }
        });
    }

    // GPS Location Feature

    const locationButton =
        document.getElementById("getLocationBtn");

    if (locationButton) {

        locationButton.addEventListener("click", function () {

            const locationInput =
                document.getElementById("location");

            const message =
                document.getElementById("locationMessage");

            if (!navigator.geolocation) {
                message.textContent =
                    "Geolocation is not supported by your browser.";
                return;
            }

            message.textContent = "Getting your location...";

            navigator.geolocation.getCurrentPosition(

                function (position) {

                    const latitude =
                        position.coords.latitude;

                    const longitude =
                        position.coords.longitude;

                    locationInput.value =
                        latitude + ", " + longitude;

                    message.textContent =
                        "Location captured successfully!";

                },

                function () {

                    message.textContent =
                        "Location unavailable. Allow browser location access and try again.";

                }

            );

        });

    }

    // Get complaints from localStorage
    function getComplaints() {
        return JSON.parse(
            localStorage.getItem("complaints")
        ) || [];
    }

    // Save complaints to localStorage
    function saveComplaints(complaints) {
        localStorage.setItem(
            "complaints",
            JSON.stringify(complaints)
        );
    }

    // Safely display user-entered text in HTML
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


    /* =========================
       SUBMIT COMPLAINT
       ========================= */

    const complaintForm =
        document.getElementById("complaintForm");

    if (complaintForm) {

        complaintForm.addEventListener("submit", function (event) {

            event.preventDefault();

            const name =
                document.getElementById("name").value.trim();

            const category =
                document.getElementById("category").value;

            const description =
                document.getElementById("description").value.trim();

            const location =
                document.getElementById("location").value.trim();

            if (!name || !category || !description || !location) {
                alert("Please fill in all required fields.");
                return;
            }

            // Generate a unique complaint ID
            const complaints = getComplaints();
            let complaintID;

            do {
                complaintID =
                    "CR" + Math.floor(1000 + Math.random() * 9000);
            } while (complaints.some(item => item.id === complaintID));

            const complaint = {
                id: complaintID,
                name: name,
                category: category,
                description: description,
                location: location,
                status: "Pending"
            };

            complaints.push(complaint);
            saveComplaints(complaints);

            alert(
                "Complaint submitted successfully!\n\n" +
                "Your Complaint ID is: " + complaintID
            );

            complaintForm.reset();
        });
    }


    /* =========================
       TRACK COMPLAINT
       ========================= */

    const trackForm =
        document.getElementById("trackForm");

    if (trackForm) {

        trackForm.addEventListener("submit", function (event) {

            event.preventDefault();

            const enteredID =
                document.getElementById("complaintID")
                    .value.trim().toUpperCase();

            const result =
                document.getElementById("complaintResult");

            const complaint = getComplaints().find(function (item) {
                return item.id.toUpperCase() === enteredID;
            });

            if (!complaint) {
                result.innerHTML = `
                    <div class="status-card">
                        <h2>Complaint Not Found</h2>
                        <p>Please check your Complaint ID and try again.</p>
                    </div>
                `;
                return;
            }

            result.innerHTML = `
                <div class="status-card">
                    <h2>Complaint Found</h2>
                    <p><strong>Complaint ID:</strong> ${escapeHTML(complaint.id)}</p>
                    <p><strong>Name:</strong> ${escapeHTML(complaint.name)}</p>
                    <p><strong>Category:</strong> ${escapeHTML(complaint.category)}</p>
                    <p><strong>Description:</strong> ${escapeHTML(complaint.description)}</p>
                    <p><strong>Location:</strong> ${escapeHTML(complaint.location)}</p>
                    <p><strong>Status:</strong> <span class="complaint-status">${escapeHTML(complaint.status)}</span></p>
                </div>
            `;
        });
    }


    /* =========================
       ADMIN DASHBOARD
       ========================= */

    const complaintTableBody =
        document.getElementById("complaintTableBody");

    if (complaintTableBody) {

        function renderDashboard() {

            const complaints = getComplaints();

            // Calculate totals
            const total = complaints.length;

            const pending = complaints.filter(function (item) {
                return item.status === "Pending";
            }).length;

            const resolved = complaints.filter(function (item) {
                return item.status === "Resolved";
            }).length;

            // Update dashboard cards
            document.getElementById("totalComplaints").textContent = total;
            document.getElementById("pendingComplaints").textContent = pending;
            document.getElementById("resolvedComplaints").textContent = resolved;

            // Show empty message if there are no complaints
            if (complaints.length === 0) {
                complaintTableBody.innerHTML = `
                    <tr>
                        <td colspan="5">No complaints found.</td>
                    </tr>
                `;
                return;
            }

            // Display complaint rows
            complaintTableBody.innerHTML = "";

            complaints.forEach(function (complaint) {

                const row = document.createElement("tr");

                row.innerHTML = `
                    <td>${escapeHTML(complaint.id)}</td>
                    <td>${escapeHTML(complaint.name)}</td>
                    <td>${escapeHTML(complaint.category)}</td>
                    <td>${escapeHTML(complaint.location)}</td>
                    <td>
                        <select class="status-select"
                                data-id="${escapeHTML(complaint.id)}"
                                aria-label="Update status for ${escapeHTML(complaint.id)}">
                            <option value="Pending">Pending</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Resolved">Resolved</option>
                        </select>
                    </td>
                `;

                const statusSelect = row.querySelector(".status-select");
                statusSelect.value = complaint.status;

                complaintTableBody.appendChild(row);
            });
        }

        // Handle status changes
        complaintTableBody.addEventListener("change", function (event) {

            if (!event.target.matches(".status-select")) {
                return;
            }

            const complaintID = event.target.dataset.id;
            const newStatus = event.target.value;

            const complaints = getComplaints();

            const complaint = complaints.find(function (item) {
                return item.id === complaintID;
            });

            if (complaint) {
                complaint.status = newStatus;
                saveComplaints(complaints);
                renderDashboard();
            }
        });

        // Display dashboard on page load
        renderDashboard();
    }

});
