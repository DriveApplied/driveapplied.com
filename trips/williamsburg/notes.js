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
  const archiveStatus = document.querySelector("#archiveStatus");
  const exportButton = document.querySelector("#exportNotes");
  const shareButton = document.querySelector("#shareNotes");
  const printButton = document.querySelector("#printNotes");
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

  function sortedNotes() {
    return readNotes().sort((a, b) => {
      return b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt);
    });
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

  function notesAsMarkdown(notes) {
    const entries = notes.map((note) => {
      const details = [
        `**Date:** ${formatDate(note.date)}`,
        note.place ? `**Place:** ${note.place}` : "",
        `**Kind:** ${kinds[note.kind] || "Field note"}`
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

  function setArchiveStatus(message) {
    archiveStatus.textContent = message;
    window.clearTimeout(setArchiveStatus.timer);
    setArchiveStatus.timer = window.setTimeout(() => {
      if (archiveStatus.textContent === message) archiveStatus.textContent = "";
    }, 3200);
  }

  function downloadMarkdown(notes) {
    const blob = new Blob([notesAsMarkdown(notes)], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `williamsburg-field-notes-${easternDateKey()}.md`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setArchiveStatus("Field notes exported.");
  }

  async function shareNotes(notes) {
    const markdown = notesAsMarkdown(notes);

    try {
      const file = typeof File === "function"
        ? new File(
            [markdown],
            `williamsburg-field-notes-${easternDateKey()}.md`,
            { type: "text/markdown" }
          )
        : null;

      if (file && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: "Williamsburg Field Notes",
          text: "Our notes from Williamsburg.",
          files: [file]
        });
        setArchiveStatus("Field notes shared.");
        return;
      }

      if (navigator.share) {
        await navigator.share({
          title: "Williamsburg Field Notes",
          text: markdown
        });
        setArchiveStatus("Field notes shared.");
        return;
      }

      await navigator.clipboard.writeText(markdown);
      setArchiveStatus("Sharing is unavailable here, so the notes were copied to your clipboard.");
    } catch (error) {
      if (error && error.name === "AbortError") return;

      try {
        await navigator.clipboard.writeText(markdown);
        setArchiveStatus("The share sheet was unavailable, so the notes were copied to your clipboard.");
      } catch {
        downloadMarkdown(notes);
        setArchiveStatus("Sharing was unavailable. A notes file was downloaded instead.");
      }
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
  exportButton.addEventListener("click", () => downloadMarkdown(sortedNotes()));
  shareButton.addEventListener("click", () => shareNotes(sortedNotes()));
  printButton.addEventListener("click", () => window.print());
  resetEditor();
  render();
})();
