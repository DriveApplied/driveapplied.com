(function () {
  const NOTES_KEY = "driveapplied-williamsburg-field-notes";
  const DB_NAME = "driveapplied-williamsburg-field-notes-photos";
  const DB_VERSION = 1;
  const PHOTO_STORE = "photos";
  const MAX_PHOTO_EDGE = 1600;
  const MAX_THUMB_EDGE = 520;
  const kinds = {
    memory: "Memory",
    history: "History discovered",
    food: "Food & drink",
    favorite: "Family favorite",
    return: "Return someday",
    practical: "Practical note"
  };

  const form = document.querySelector("#noteForm");
  const titleInput = document.querySelector("#noteTitle");
  const dateInput = document.querySelector("#noteDate");
  const placeInput = document.querySelector("#notePlace");
  const kindInput = document.querySelector("#noteKind");
  const bodyInput = document.querySelector("#noteBody");
  const photoInput = document.querySelector("#notePhotos");
  const photoPreview = document.querySelector("#photoPreview");
  const photoStatus = document.querySelector("#photoStatus");
  const list = document.querySelector("#notesList");
  const emptyState = document.querySelector("#emptyNotes");
  const noteCount = document.querySelector("#noteCount");
  const editorTitle = document.querySelector("#editorTitle");
  const saveButton = document.querySelector("#saveNote");
  const cancelButton = document.querySelector("#cancelEdit");
  const saveStatus = document.querySelector("#saveStatus");
  const archiveStatus = document.querySelector("#archiveStatus");
  const exportButton = document.querySelector("#exportNotes");
  const shareButton = document.querySelector("#shareNotes");
  const printButton = document.querySelector("#printNotes");
  const template = document.querySelector("#noteTemplate");

  let editingId = null;
  let existingPhotos = [];
  let pendingPhotos = [];
  let removedPhotoIds = new Set();
  let previewUrls = [];

  function makeId() {
    return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function easternDateKey() {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  function readNotes() {
    try {
      const stored = JSON.parse(localStorage.getItem(NOTES_KEY) || "[]");
      return Array.isArray(stored) ? stored : [];
    } catch {
      return [];
    }
  }

  function writeNotes(notes) {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  }

  function sortedNotes() {
    return readNotes().sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));
  }

  function openPhotoDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(PHOTO_STORE)) {
          const store = database.createObjectStore(PHOTO_STORE, { keyPath: "id" });
          store.createIndex("noteId", "noteId", { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function withPhotoStore(mode, operation) {
    const database = await openPhotoDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(PHOTO_STORE, mode);
      const store = transaction.objectStore(PHOTO_STORE);
      let result;
      try {
        result = operation(store);
      } catch (error) {
        database.close();
        reject(error);
        return;
      }
      transaction.oncomplete = () => {
        database.close();
        resolve(result);
      };
      transaction.onerror = () => {
        database.close();
        reject(transaction.error);
      };
      transaction.onabort = () => {
        database.close();
        reject(transaction.error || new Error("Photo storage was interrupted."));
      };
    });
  }

  async function photosForNote(noteId) {
    const database = await openPhotoDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(PHOTO_STORE, "readonly");
      const request = transaction.objectStore(PHOTO_STORE).index("noteId").getAll(noteId);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => database.close();
    });
  }

  function savePhotoRecords(records) {
    if (!records.length) return Promise.resolve();
    return withPhotoStore("readwrite", (store) => records.forEach((record) => store.put(record)));
  }

  function deletePhotoRecords(ids) {
    if (!ids.length) return Promise.resolve();
    return withPhotoStore("readwrite", (store) => ids.forEach((id) => store.delete(id)));
  }

  async function deletePhotosForNote(noteId) {
    const photos = await photosForNote(noteId);
    await deletePhotoRecords(photos.map((photo) => photo.id));
  }

  function formatDate(value) {
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC"
    }).format(new Date(`${value}T12:00:00Z`));
  }

  function revokePreviewUrls() {
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    previewUrls = [];
  }

  function imageSource(file) {
    if (typeof createImageBitmap === "function") return createImageBitmap(file);
    return new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(file);
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error(`Unable to read ${file.name}.`));
      };
      image.src = url;
    });
  }

  function canvasBlob(canvas, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error("Unable to resize this photo.")),
        "image/jpeg",
        quality
      );
    });
  }

  async function resizePhoto(file, maxEdge, quality) {
    const source = await imageSource(file);
    const width = source.width || source.naturalWidth;
    const height = source.height || source.naturalHeight;
    const scale = Math.min(1, maxEdge / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d", { alpha: false });
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    if (typeof source.close === "function") source.close();
    return canvasBlob(canvas, quality);
  }

  async function preparePhoto(file) {
    if (!file.type.startsWith("image/")) throw new Error(`${file.name} is not an image.`);
    const [blob, thumbnail] = await Promise.all([
      resizePhoto(file, MAX_PHOTO_EDGE, 0.84),
      resizePhoto(file, MAX_THUMB_EDGE, 0.76)
    ]);
    return {
      id: makeId(),
      name: file.name.replace(/\.[^.]+$/, "") + ".jpg",
      type: "image/jpeg",
      blob,
      thumbnail,
      createdAt: new Date().toISOString()
    };
  }

  function renderPhotoEditor() {
    revokePreviewUrls();
    photoPreview.replaceChildren();
    const retained = existingPhotos.filter((photo) => !removedPhotoIds.has(photo.id));
    const photos = [...retained, ...pendingPhotos];

    photos.forEach((photo) => {
      const figure = document.createElement("figure");
      figure.className = "photo-preview-item";
      const image = document.createElement("img");
      const url = URL.createObjectURL(photo.thumbnail || photo.blob);
      previewUrls.push(url);
      image.src = url;
      image.alt = photo.name || "Attached field note photo";
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove-photo";
      remove.setAttribute("aria-label", `Remove ${photo.name || "photo"}`);
      remove.textContent = "×";
      remove.addEventListener("click", () => {
        if (existingPhotos.some((entry) => entry.id === photo.id)) {
          removedPhotoIds.add(photo.id);
        } else {
          pendingPhotos = pendingPhotos.filter((entry) => entry.id !== photo.id);
        }
        renderPhotoEditor();
      });
      figure.append(image, remove);
      photoPreview.append(figure);
    });

    photoPreview.hidden = photos.length === 0;
  }

  function resetEditor() {
    editingId = null;
    existingPhotos = [];
    pendingPhotos = [];
    removedPhotoIds = new Set();
    revokePreviewUrls();
    form.reset();
    dateInput.value = easternDateKey();
    editorTitle.textContent = "Add a field note";
    saveButton.textContent = "Save note";
    saveButton.disabled = false;
    cancelButton.hidden = true;
    saveStatus.textContent = "";
    photoStatus.textContent = "";
    photoPreview.replaceChildren();
    photoPreview.hidden = true;
  }

  function notesAsMarkdown(notes) {
    const entries = notes.map((note) => {
      const details = [
        `**Date:** ${formatDate(note.date)}`,
        note.place ? `**Place:** ${note.place}` : "",
        `**Kind:** ${kinds[note.kind] || "Field note"}`,
        note.photoCount ? `**Photos:** ${note.photoCount}` : ""
      ].filter(Boolean).join("  \n");
      return `## ${note.title}\n\n${details}\n\n${note.body}`;
    });
    return [
      "# Williamsburg Field Notes",
      "",
      `Exported ${new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeStyle: "short" }).format(new Date())}`,
      "",
      entries.join("\n\n---\n\n"),
      ""
    ].join("\n");
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[character]);
  }

  function blobDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  async function notesAsHtml(notes) {
    const entries = [];
    for (const note of notes) {
      const photos = await photosForNote(note.id);
      const photoMarkup = (await Promise.all(photos.map(async (photo) => {
        const source = await blobDataUrl(photo.blob);
        return `<img src="${source}" alt="${escapeHtml(photo.name || "Field note photo")}">`;
      }))).join("");
      entries.push(`
        <article>
          <p class="meta">${escapeHtml(formatDate(note.date))}${note.place ? ` · ${escapeHtml(note.place)}` : ""} · ${escapeHtml(kinds[note.kind] || "Field note")}</p>
          <h2>${escapeHtml(note.title)}</h2>
          <p>${escapeHtml(note.body).replace(/\n/g, "<br>")}</p>
          ${photoMarkup ? `<div class="photos">${photoMarkup}</div>` : ""}
        </article>
      `);
    }
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Williamsburg Field Notes</title><style>body{max-width:850px;margin:40px auto;padding:0 24px;color:#21332f;font:16px/1.65 Georgia,serif}h1,h2{line-height:1.15}article{padding:28px 0;border-top:1px solid #bbb}.meta{color:#78604b;font:700 12px/1.4 Arial,sans-serif;text-transform:uppercase}.photos{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:18px}.photos img{display:block;width:100%;max-height:520px;object-fit:cover;border-radius:8px}@media(max-width:600px){.photos{grid-template-columns:1fr}}@media print{body{margin:0}.photos img{break-inside:avoid}}</style></head><body><h1>Williamsburg Field Notes</h1><p>Exported ${escapeHtml(new Date().toLocaleString())}</p>${entries.join("")}</body></html>`;
  }

  function setArchiveStatus(message) {
    archiveStatus.textContent = message;
    window.clearTimeout(setArchiveStatus.timer);
    setArchiveStatus.timer = window.setTimeout(() => {
      if (archiveStatus.textContent === message) archiveStatus.textContent = "";
    }, 3600);
  }

  async function exportNotes(notes) {
    exportButton.disabled = true;
    setArchiveStatus("Preparing notes and photos…");
    try {
      const html = await notesAsHtml(notes);
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `williamsburg-field-notes-${easternDateKey()}.html`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setArchiveStatus("Field notes and photos exported.");
    } catch {
      setArchiveStatus("The photo archive could not be prepared.");
    } finally {
      exportButton.disabled = false;
    }
  }

  async function shareNotes(notes) {
    shareButton.disabled = true;
    setArchiveStatus("Preparing notes and photos…");
    try {
      const html = await notesAsHtml(notes);
      const file = typeof File === "function"
        ? new File([html], `williamsburg-field-notes-${easternDateKey()}.html`, { type: "text/html" })
        : null;
      if (file && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ title: "Williamsburg Field Notes", text: "Our notes and photos from Williamsburg.", files: [file] });
        setArchiveStatus("Field notes shared.");
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: "Williamsburg Field Notes", text: notesAsMarkdown(notes) });
        setArchiveStatus("Text notes shared. Use Export to include photos.");
        return;
      }
      await navigator.clipboard.writeText(notesAsMarkdown(notes));
      setArchiveStatus("Sharing is unavailable here, so the text notes were copied.");
    } catch (error) {
      if (error && error.name === "AbortError") {
        archiveStatus.textContent = "";
        return;
      }
      try {
        await navigator.clipboard.writeText(notesAsMarkdown(notes));
        setArchiveStatus("The share sheet was unavailable, so the text notes were copied.");
      } catch {
        setArchiveStatus("Sharing was unavailable. Use Export to save the notes and photos.");
      }
    } finally {
      shareButton.disabled = false;
    }
  }

  async function renderCardPhotos(container, noteId) {
    try {
      const photos = await photosForNote(noteId);
      if (!photos.length) {
        container.hidden = true;
        return;
      }
      photos.forEach((photo) => {
        const image = document.createElement("img");
        const url = URL.createObjectURL(photo.thumbnail || photo.blob);
        image.src = url;
        image.alt = photo.name || "Field note photo";
        image.onload = () => URL.revokeObjectURL(url);
        container.append(image);
      });
    } catch {
      container.hidden = true;
    }
  }

  function render() {
    const notes = sortedNotes();
    list.replaceChildren();
    emptyState.hidden = notes.length > 0;
    noteCount.textContent = `${notes.length} ${notes.length === 1 ? "note" : "notes"}`;
    exportButton.disabled = notes.length === 0;
    shareButton.disabled = notes.length === 0;
    printButton.disabled = notes.length === 0;

    notes.forEach((note) => {
      const fragment = template.content.cloneNode(true);
      const card = fragment.querySelector(".note-card");
      card.dataset.id = note.id;
      fragment.querySelector(".note-kind").textContent = kinds[note.kind] || "Field note";
      fragment.querySelector("time").dateTime = note.date;
      fragment.querySelector("time").textContent = formatDate(note.date);
      fragment.querySelector("h3").textContent = note.title;
      const place = fragment.querySelector(".note-place");
      place.textContent = note.place ? `⌖ ${note.place}` : "";
      place.hidden = !note.place;
      fragment.querySelector(".note-body").textContent = note.body;
      const photos = fragment.querySelector(".note-photos");
      renderCardPhotos(photos, note.id);
      fragment.querySelector(".edit-note").addEventListener("click", () => editNote(note.id));
      fragment.querySelector(".delete-note").addEventListener("click", () => deleteNote(note.id));
      list.append(fragment);
    });
  }

  async function editNote(id) {
    const note = readNotes().find((entry) => entry.id === id);
    if (!note) return;
    editingId = id;
    existingPhotos = await photosForNote(id).catch(() => []);
    pendingPhotos = [];
    removedPhotoIds = new Set();
    titleInput.value = note.title;
    dateInput.value = note.date;
    placeInput.value = note.place;
    kindInput.value = note.kind;
    bodyInput.value = note.body;
    editorTitle.textContent = "Edit field note";
    saveButton.textContent = "Update note";
    cancelButton.hidden = false;
    saveStatus.textContent = "";
    renderPhotoEditor();
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    titleInput.focus({ preventScroll: true });
  }

  async function deleteNote(id) {
    const notes = readNotes();
    const note = notes.find((entry) => entry.id === id);
    if (!note) return;
    if (!window.confirm(`Delete “${note.title}” and its photos? This cannot be undone.`)) return;
    await deletePhotosForNote(id).catch(() => {});
    writeNotes(notes.filter((entry) => entry.id !== id));
    if (editingId === id) resetEditor();
    render();
  }

  photoInput.addEventListener("change", async () => {
    const files = Array.from(photoInput.files || []);
    if (!files.length) return;
    photoInput.disabled = true;
    photoStatus.textContent = `Preparing ${files.length} ${files.length === 1 ? "photo" : "photos"}…`;
    try {
      for (const file of files) {
        pendingPhotos.push(await preparePhoto(file));
      }
      photoStatus.textContent = `${files.length} ${files.length === 1 ? "photo" : "photos"} ready to save.`;
      renderPhotoEditor();
    } catch (error) {
      photoStatus.textContent = error.message || "One of the photos could not be prepared.";
    } finally {
      photoInput.value = "";
      photoInput.disabled = false;
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const now = new Date().toISOString();
    const notes = readNotes();
    const noteId = editingId || makeId();
    const retainedPhotoCount = existingPhotos.filter((photo) => !removedPhotoIds.has(photo.id)).length;
    const note = {
      id: noteId,
      title: titleInput.value.trim(),
      date: dateInput.value,
      place: placeInput.value.trim(),
      kind: kindInput.value,
      body: bodyInput.value.trim(),
      photoCount: retainedPhotoCount + pendingPhotos.length,
      createdAt: now,
      updatedAt: now
    };
    if (!note.title || !note.date || !note.body) return;

    saveButton.disabled = true;
    saveButton.textContent = "Saving…";
    saveStatus.textContent = "Saving note and photos…";
    try {
      await deletePhotoRecords(Array.from(removedPhotoIds));
      await savePhotoRecords(pendingPhotos.map((photo) => ({ ...photo, noteId })));
      if (editingId) {
        const index = notes.findIndex((entry) => entry.id === editingId);
        if (index >= 0) {
          note.createdAt = notes[index].createdAt;
          notes[index] = note;
        }
      } else {
        notes.push(note);
      }
      writeNotes(notes);
      const message = editingId ? "Note updated." : "Note saved.";
      resetEditor();
      saveStatus.textContent = message;
      render();
      window.setTimeout(() => {
        if (saveStatus.textContent === message) saveStatus.textContent = "";
      }, 2400);
    } catch (error) {
      saveButton.disabled = false;
      saveButton.textContent = editingId ? "Update note" : "Save note";
      saveStatus.textContent = error && error.name === "QuotaExceededError"
        ? "This browser is out of photo storage. Remove a photo and try again."
        : "The note could not be saved with its photos.";
    }
  });

  cancelButton.addEventListener("click", resetEditor);
  exportButton.addEventListener("click", () => exportNotes(sortedNotes()));
  shareButton.addEventListener("click", () => shareNotes(sortedNotes()));
  printButton.addEventListener("click", () => window.print());
  window.addEventListener("beforeunload", revokePreviewUrls);

  resetEditor();
  render();
})();
