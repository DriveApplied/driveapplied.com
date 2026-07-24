(function () {
  const STORAGE_KEY = "driveapplied-williamsburg-field-notes";
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
  const list = document.querySelector("#notesList");
  const emptyState = document.querySelector("#emptyNotes");
  const noteCount = document.querySelector("#noteCount");
  const editorTitle = document.querySelector("#editorTitle");
  const saveButton = document.querySelector("#saveNote");
  const cancelButton = document.querySelector("#cancelEdit");
  const saveStatus = document.querySelector("#saveStatus");
  const template = document.querySelector("#noteTemplate");
  let editingId = null;

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
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(stored) ? stored : [];
    } catch {
      return [];
    }
  }

  function writeNotes(notes) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }

  function formatDate(value) {
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC"
    }).format(new Date(`${value}T12:00:00Z`));
  }

  function resetEditor() {
    editingId = null;
    form.reset();
    dateInput.value = easternDateKey();
    editorTitle.textContent = "Add a field note";
    saveButton.textContent = "Save note";
    cancelButton.hidden = true;
    saveStatus.textContent = "";
  }

  function render() {
    const notes = readNotes().sort((a, b) => {
      return b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt);
    });
    list.replaceChildren();
    emptyState.hidden = notes.length > 0;
    noteCount.textContent = `${notes.length} ${notes.length === 1 ? "note" : "notes"}`;

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
      fragment.querySelector(".edit-note").addEventListener("click", () => editNote(note.id));
      fragment.querySelector(".delete-note").addEventListener("click", () => deleteNote(note.id));
      list.append(fragment);
    });
  }

  function editNote(id) {
    const note = readNotes().find((entry) => entry.id === id);
    if (!note) return;
    editingId = id;
    titleInput.value = note.title;
    dateInput.value = note.date;
    placeInput.value = note.place;
    kindInput.value = note.kind;
    bodyInput.value = note.body;
    editorTitle.textContent = "Edit field note";
    saveButton.textContent = "Update note";
    cancelButton.hidden = false;
    saveStatus.textContent = "";
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    titleInput.focus({ preventScroll: true });
  }

  function deleteNote(id) {
    const notes = readNotes();
    const note = notes.find((entry) => entry.id === id);
    if (!note) return;
    if (!window.confirm(`Delete “${note.title}”? This cannot be undone.`)) return;
    writeNotes(notes.filter((entry) => entry.id !== id));
    if (editingId === id) resetEditor();
    render();
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const now = new Date().toISOString();
    const notes = readNotes();
    const note = {
      id: editingId || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
      title: titleInput.value.trim(),
      date: dateInput.value,
      place: placeInput.value.trim(),
      kind: kindInput.value,
      body: bodyInput.value.trim(),
      createdAt: now,
      updatedAt: now
    };
    if (!note.title || !note.date || !note.body) return;

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
  });

  cancelButton.addEventListener("click", resetEditor);
  resetEditor();
  render();
})();
