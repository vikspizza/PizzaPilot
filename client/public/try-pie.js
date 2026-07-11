(function () {
  /** @type {{ available: false, soldOut?: boolean } | { available: true, batch: { id: string }, pizzaId: string, date: string, slots: Array<{ slotId: string, pickupTime: string }>, bookedSlotIds: string[] } | null} */
  let context = null;
  /** @type {string | null} */
  let holdId = null;
  /** @type {string | null} */
  let heldSlotId = null;
  /** @type {ReturnType<typeof setInterval> | null} */
  let holdTimerId = null;
  /** @type {number | null} */
  let holdEndsAtMs = null;
  let holdInFlight = false;
  let isPopulatingSlots = false;

  const HOLD_TIMEOUT_MESSAGE =
    "Your reservation timed out. Please select a pickup time again.";

  const btn = document.getElementById("try-pie-btn");
  const modal = document.getElementById("try-pie-modal");
  const backdrop = document.getElementById("try-pie-modal-backdrop");
  const closeBtn = document.getElementById("try-pie-modal-close");
  const form = document.getElementById("try-pie-form");
  const slotSelect = document.getElementById("try-pie-slot");
  const nameInput = document.getElementById("try-pie-name");
  const phoneInput = document.getElementById("try-pie-phone");
  const emailInput = document.getElementById("try-pie-email");
  const submitBtn = document.getElementById("try-pie-submit");
  const errorEl = document.getElementById("try-pie-error");
  const successEl = document.getElementById("try-pie-success");
  const statusEl = document.getElementById("try-pie-status");
  const timerEl = document.getElementById("try-pie-timer");
  const upcomingBatchEl = document.getElementById("upcoming-batch");
  const upcomingBatchHeadingEl = document.getElementById("upcoming-batch-heading");
  const upcomingBatchPizzasEl = document.getElementById("upcoming-batch-pizzas");

  if (
    !btn ||
    !modal ||
    !backdrop ||
    !closeBtn ||
    !form ||
    !slotSelect ||
    !nameInput ||
    !phoneInput ||
    !emailInput ||
    !submitBtn ||
    !errorEl ||
    !successEl ||
    !timerEl ||
    !upcomingBatchEl ||
    !upcomingBatchHeadingEl ||
    !upcomingBatchPizzasEl
  ) {
    return;
  }

  function formatBatchDate(dateStr) {
    const parts = dateStr.split("-").map(Number);
    if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
      return dateStr;
    }
    const [year, month, day] = parts;
    const date = new Date(year, month - 1, day);
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(date);
  }

  function escapeHtml(value) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function formatCountdown(totalSeconds) {
    const seconds = Math.max(0, totalSeconds);
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${minutes}:${String(remainder).padStart(2, "0")}`;
  }

  function renderUpcomingBatch(data) {
    if (!data?.batch || !data.pizzas?.length) {
      upcomingBatchEl.hidden = true;
      upcomingBatchPizzasEl.innerHTML = "";
      return;
    }

    upcomingBatchHeadingEl.textContent = formatBatchDate(data.batch.serviceDate);
    upcomingBatchPizzasEl.innerHTML = data.pizzas
      .map((pizza) => {
        const imageMarkup = pizza.imageUrl
          ? `<img class="upcoming-pizza-image" src="${escapeHtml(pizza.imageUrl)}" alt="${escapeHtml(pizza.name)}" loading="lazy" />`
          : `<div class="upcoming-pizza-image upcoming-pizza-image-placeholder" aria-hidden="true"></div>`;

        return `
          <article class="upcoming-pizza-card">
            <div class="upcoming-pizza-media">${imageMarkup}</div>
            <div class="upcoming-pizza-body">
              <h3 class="upcoming-pizza-name">${escapeHtml(pizza.name)}</h3>
              <p class="upcoming-pizza-description">${escapeHtml(pizza.description)}</p>
            </div>
          </article>
        `;
      })
      .join("");

    upcomingBatchEl.hidden = false;
  }

  function formatPickupTime(time) {
    const parts = time.split(":");
    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      return time;
    }
    const date = new Date(2000, 0, 1, hours, minutes);
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  }

  function setError(message) {
    errorEl.textContent = message;
    errorEl.hidden = !message;
  }

  function setStatus(message) {
    if (statusEl) {
      statusEl.textContent = message;
    }
  }

  function updateTimerDisplay() {
    if (!holdEndsAtMs) {
      timerEl.textContent = "";
      timerEl.classList.remove("try-pie-timer-expired");
      return;
    }

    const secondsLeft = Math.ceil((holdEndsAtMs - Date.now()) / 1000);
    if (secondsLeft <= 0) {
      timerEl.textContent = "Reservation expired";
      timerEl.classList.add("try-pie-timer-expired");
      return;
    }

    timerEl.textContent = `Complete your order in ${formatCountdown(secondsLeft)}`;
    timerEl.classList.remove("try-pie-timer-expired");
  }

  function clearHoldTimer() {
    if (holdTimerId) {
      clearInterval(holdTimerId);
      holdTimerId = null;
    }
    holdEndsAtMs = null;
    updateTimerDisplay();
  }

  async function releaseHold() {
    const currentHoldId = holdId;
    holdId = null;
    heldSlotId = null;
    if (!currentHoldId) {
      return;
    }

    try {
      await fetch(`/api/try-pie/hold/${encodeURIComponent(currentHoldId)}`, {
        method: "DELETE",
      });
    } catch {
      // Best-effort release; server also expires holds automatically.
    }
  }

  function resetHoldState() {
    form.classList.remove("try-pie-form-expired");
    timerEl.classList.remove("try-pie-timer-expired");
    setError("");
  }

  async function expireHold() {
    if (!holdId && !holdEndsAtMs) {
      return;
    }

    clearHoldTimer();
    await releaseHold();
    /** @type {HTMLSelectElement} */ (slotSelect).value = "";
    setError(HOLD_TIMEOUT_MESSAGE);
    timerEl.textContent = "";
    await loadContext();
    updateSubmitState();
  }

  function startHoldTimer(expiresInSeconds) {
    clearHoldTimer();
    holdEndsAtMs = Date.now() + expiresInSeconds * 1000;
    updateTimerDisplay();

    holdTimerId = setInterval(() => {
      const secondsLeft = Math.ceil((holdEndsAtMs - Date.now()) / 1000);
      if (secondsLeft <= 0) {
        void expireHold();
        return;
      }
      updateTimerDisplay();
    }, 250);
  }

  function normalizePhone(value) {
    return value.replace(/\D/g, "").slice(0, 10);
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function validateForm() {
    if (holdInFlight) {
      return "Reserving pickup time…";
    }

    const name = /** @type {HTMLInputElement} */ (nameInput).value.trim();
    const phone = normalizePhone(/** @type {HTMLInputElement} */ (phoneInput).value);
    const email = /** @type {HTMLInputElement} */ (emailInput).value.trim();
    const slotId = /** @type {HTMLSelectElement} */ (slotSelect).value;
    const selectedOption = /** @type {HTMLSelectElement} */ (slotSelect).selectedOptions[0];

    if (!slotId || selectedOption?.disabled) {
      return "Please select an available pickup time.";
    }
    if (!holdId) {
      return "Please select an available pickup time.";
    }
    if (name.length < 2) {
      return "Please enter the name for pickup.";
    }
    if (phone.length !== 10) {
      return "Phone number must be exactly 10 digits.";
    }
    if (!isValidEmail(email)) {
      return "Please enter a valid email address.";
    }
    return null;
  }

  function updateSubmitState() {
    const validationError = validateForm();
    /** @type {HTMLButtonElement} */ (submitBtn).disabled =
      Boolean(validationError) ||
      /** @type {HTMLButtonElement} */ (submitBtn).dataset.loading === "true";
  }

  function populateSlots(slots, bookedSlotIds) {
    const select = /** @type {HTMLSelectElement} */ (slotSelect);
    const booked = new Set(bookedSlotIds ?? []);
    isPopulatingSlots = true;
    select.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = slots.length ? "Select pickup time" : "No pickup times available";
    placeholder.disabled = true;
    placeholder.selected = !heldSlotId;
    select.appendChild(placeholder);

    for (const slot of slots) {
      const option = document.createElement("option");
      const isBooked = booked.has(slot.slotId) && slot.slotId !== heldSlotId;
      option.value = slot.slotId;
      option.textContent = isBooked
        ? `${formatPickupTime(slot.pickupTime)} (Taken)`
        : formatPickupTime(slot.pickupTime);
      option.disabled = isBooked;
      if (isBooked) {
        option.className = "try-pie-slot-taken";
      }
      if (slot.slotId === heldSlotId) {
        option.selected = true;
      }
      select.appendChild(option);
    }

    isPopulatingSlots = false;
    updateSubmitState();
  }

  async function loadContext() {
    try {
      const res = await fetch("/api/try-pie/context");
      if (!res.ok) {
        throw new Error("Failed to load");
      }
      context = await res.json();
      renderUpcomingBatch(context);

      if (!context || !context.available) {
        /** @type {HTMLButtonElement} */ (btn).disabled = true;
        /** @type {HTMLButtonElement} */ (btn).classList.add("try-pie-btn-sold-out");
        setStatus(
          context?.soldOut
            ? "SOLD OUT."
            : "Pizza is available Friday or Saturday evenings. Signup usually opens up 24 hours in advance. Please check back here. Many thanks for your support. 🙏",
        );
        return false;
      }

      /** @type {HTMLButtonElement} */ (btn).disabled = false;
      /** @type {HTMLButtonElement} */ (btn).classList.remove("try-pie-btn-sold-out");
      setStatus("");
      populateSlots(context.slots, context.bookedSlotIds);
      return true;
    } catch {
      /** @type {HTMLButtonElement} */ (btn).disabled = true;
      upcomingBatchEl.hidden = true;
      upcomingBatchPizzasEl.innerHTML = "";
      setStatus("Unable to check availability. Please try again later.");
      return false;
    }
  }

  async function reserveSlot(slotId) {
    if (!context || !context.available || !context.date) {
      return false;
    }

    const res = await fetch("/api/try-pie/hold", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        batchId: context.batch.id,
        pizzaId: context.pizzaId,
        date: context.date,
        slotId,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(
        typeof data.error === "string"
          ? data.error
          : "That pickup time is no longer available. Please choose another slot.",
      );
      return false;
    }

    holdId = data.holdId;
    heldSlotId = slotId;
    startHoldTimer(Number(data.expiresInSeconds) || 60);
    return true;
  }

  async function handleSlotChange() {
    if (isPopulatingSlots) {
      return;
    }

    const slotId = /** @type {HTMLSelectElement} */ (slotSelect).value;

    clearHoldTimer();
    await releaseHold();
    resetHoldState();
    timerEl.textContent = "";

    if (!slotId) {
      updateSubmitState();
      return;
    }

    if (!context || !context.available || holdInFlight) {
      updateSubmitState();
      return;
    }

    holdInFlight = true;
    updateSubmitState();

    try {
      const reserved = await reserveSlot(slotId);
      if (!reserved) {
        /** @type {HTMLSelectElement} */ (slotSelect).value = "";
        await loadContext();
      }
    } finally {
      holdInFlight = false;
      updateSubmitState();
    }
  }

  function openModal() {
    modal.hidden = false;
    document.body.classList.add("try-pie-modal-open");
    setError("");
    /** @type {HTMLInputElement} */ (nameInput).focus();
  }

  async function closeModal() {
    clearHoldTimer();
    await releaseHold();
    resetHoldState();
    modal.hidden = true;
    document.body.classList.remove("try-pie-modal-open");
    await loadContext();
  }

  /** @type {HTMLButtonElement} */ (btn).addEventListener("click", async () => {
    if (/** @type {HTMLButtonElement} */ (btn).disabled) {
      return;
    }

    successEl.hidden = true;
    const ready = await loadContext();
    if (!ready) {
      return;
    }

    clearHoldTimer();
    await releaseHold();
    resetHoldState();
    openModal();
  });

  closeBtn.addEventListener("click", () => {
    void closeModal();
  });

  /** @type {HTMLInputElement} */ (phoneInput).addEventListener("input", (event) => {
    const input = /** @type {HTMLInputElement} */ (event.target);
    const digits = normalizePhone(input.value);
    input.value = digits;
    updateSubmitState();
  });

  for (const el of [nameInput, emailInput]) {
    el.addEventListener("input", updateSubmitState);
    el.addEventListener("change", updateSubmitState);
  }

  slotSelect.addEventListener("change", () => {
    void handleSlotChange();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setError("");

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!context || !context.available || !holdId) {
      setError("Ordering is no longer available. Please refresh the page.");
      return;
    }

    const payload = {
      pizzaId: context.pizzaId,
      batchId: context.batch.id,
      quantity: 1,
      type: "pickup",
      date: context.date,
      slotId: /** @type {HTMLSelectElement} */ (slotSelect).value,
      customerName: /** @type {HTMLInputElement} */ (nameInput).value.trim(),
      customerEmail: /** @type {HTMLInputElement} */ (emailInput).value.trim(),
      customerPhone: normalizePhone(/** @type {HTMLInputElement} */ (phoneInput).value),
      holdId,
    };

    /** @type {HTMLButtonElement} */ (submitBtn).disabled = true;
    /** @type {HTMLButtonElement} */ (submitBtn).dataset.loading = "true";
    /** @type {HTMLButtonElement} */ (submitBtn).textContent = "Submitting…";

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const message =
          typeof data.error === "string"
            ? data.error
            : "Could not place your order. Please try again.";
        throw new Error(message);
      }

      clearHoldTimer();
      holdId = null;
      heldSlotId = null;
      modal.hidden = true;
      document.body.classList.remove("try-pie-modal-open");
      resetHoldState();
      form.reset();
      successEl.hidden = false;
      successEl.textContent =
        "Order received! We'll email confirmation with pickup details.";
      /** @type {HTMLButtonElement} */ (btn).textContent = "Order placed";
      /** @type {HTMLButtonElement} */ (btn).disabled = true;
    } catch (error) {
      setError(error instanceof Error ? error.message : "Something went wrong.");
      /** @type {HTMLButtonElement} */ (submitBtn).disabled = false;
      /** @type {HTMLButtonElement} */ (submitBtn).dataset.loading = "false";
      /** @type {HTMLButtonElement} */ (submitBtn).textContent = "Submit order";
      updateSubmitState();
    }
  });

  loadContext();
})();
