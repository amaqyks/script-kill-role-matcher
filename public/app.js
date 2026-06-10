// ── State ──
const state = {
  personaLoaded: false,
  roleRecords: []
};

// ── Tab switching ──
const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".panel");
document.getElementById("mainTabs").addEventListener("click", (e) => {
  const tab = e.target.closest(".tab");
  if (!tab) return;
  switchTab(tab.dataset.tab);
});

function switchTab(id) {
  tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === id));
  panels.forEach(p => p.classList.toggle("active", p.id === id));
  if (id === "chat") refreshChatContext();
}

// ── Chips ──
document.querySelectorAll(".chips button").forEach(btn => {
  btn.addEventListener("click", () => btn.classList.toggle("selected"));
});

// ── Helpers ──
function val(id) { return document.getElementById(id)?.value?.trim() || ""; }
function setVal(id, v) { const el = document.getElementById(id); if (el) el.value = v ?? ""; }
function selChips(field) {
  return [...document.querySelectorAll(`.chips[data-field="${field}"] .selected`)].map(b => b.textContent.trim());
}
function setChips(field, values) {
  document.querySelectorAll(`.chips[data-field="${field}"] button`).forEach(b => {
    b.classList.toggle("selected", (values || []).includes(b.textContent.trim()));
  });
}
function setStatus(msg) { document.getElementById("systemStatus").textContent = msg; }

async function api(method, path, body) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(path, opts);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// ── Escape ──
function esc(s) { return String(s ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;"); }

// ══════════════════ Persona ══════════════════

document.getElementById("savePersonaBtn").addEventListener("click", savePersona);

function readPersona() {
  return {
    mbti: val("mbti"),
    zodiac: val("zodiac"),
    gender: val("gender"),
    crossGender: val("crossGender"),
    preferredLines: selChips("preferredLines"),
    preferredTraits: selChips("preferredTraits"),
    avoidTags: selChips("avoidTags"),
    freeText: val("freeText")
  };
}

function writePersona(p) {
  if (!p) return;
  setVal("mbti", p.mbti);
  setVal("zodiac", p.zodiac);
  setVal("gender", p.gender);
  setVal("crossGender", p.crossGender);
  setChips("preferredLines", p.preferredLines);
  setChips("preferredTraits", p.preferredTraits);
  setChips("avoidTags", p.avoidTags);
  setVal("freeText", p.freeText);
}

async function savePersona() {
  const btn = document.getElementById("savePersonaBtn");
  const hint = document.getElementById("personaHint");
  btn.disabled = true;
  btn.textContent = "保存中...";
  try {
    const persona = readPersona();
    const data = await api("POST", "/api/persona", persona);
    hint.textContent = "\u2713" + data.message;
    hint.style.color = "#1b6b6f";
    state.personaLoaded = true;
    showPersonaPreview(data.summary);
  } catch (e) {
    hint.textContent = "\u2717 保存失败: " + e.message;
    hint.style.color = "#a64736";
  } finally {
    btn.disabled = false;
    btn.textContent = "💾 保存画像";
    setTimeout(() => { hint.textContent = ""; }, 3000);
  }
}

async function loadPersona() {
  try {
    const data = await api("GET", "/api/persona");
    if (data.persona && Object.keys(data.persona).some(k => data.persona[k])) {
      writePersona(data.persona);
      showPersonaPreview(data.summary);
      state.personaLoaded = true;
    }
  } catch { /* no saved persona yet */ }
}

function showPersonaPreview(summary) {
  const el = document.getElementById("personaPreview");
  if (!summary) { el.style.display = "none"; return; }
  el.style.display = "block";
  document.getElementById("personaSummary").innerHTML = `<pre>${esc(summary)}</pre>`;
  setStatus(summary ? "画像已加载" : "就绪");
}

// ══════════════════ Role Records ══════════════════

const showFormBtn = document.getElementById("showFormBtn");
const saveRecordBtn = document.getElementById("saveRecordBtn");
const cancelFormBtn = document.getElementById("cancelFormBtn");
const recordForm = document.getElementById("recordForm");

showFormBtn.addEventListener("click", () => openForm());
cancelFormBtn.addEventListener("click", () => closeForm());
saveRecordBtn.addEventListener("click", saveRecord);

function openForm(record) {
  if (record) {
    // 编辑模式
    setVal("recScript", record.script);
    setVal("recRole", record.role);
    setVal("recRating", record.rating);
    setVal("recTags", (record.tags || []).join("\u3001"));
    setVal("recReview", record.review);
    setVal("editRecordId", record.id);
    saveRecordBtn.textContent = "💾 更新记录";
  } else {
    // 新增模式
    clearRecordFormFields();
  }
  recordForm.style.display = "block";
  showFormBtn.style.display = "none";
  recordForm.scrollIntoView({ behavior: "smooth" });
}

function closeForm() {
  recordForm.style.display = "none";
  showFormBtn.style.display = "";
  clearRecordFormFields();
}

function clearRecordFormFields() {
  setVal("recScript", "");
  setVal("recRole", "");
  setVal("recRating", "");
  setVal("recTags", "");
  setVal("recReview", "");
  setVal("editRecordId", "");
  saveRecordBtn.textContent = "💾 保存记录";
}

async function saveRecord() {
  const id = val("editRecordId");
  const record = {
    script: val("recScript"),
    role: val("recRole"),
    rating: parseInt(val("recRating")) || 0,
    tags: val("recTags").split(/[,，、]/).map(s => s.trim()).filter(Boolean),
    review: val("recReview")
  };
  if (!record.script || !record.role) {
    alert("请至少填写剧本名称和扮演角色");
    return;
  }
  if (record.rating < 1 || record.rating > 10) {
    alert("评分请在 1-10 之间");
    return;
  }

  saveRecordBtn.disabled = true;
  saveRecordBtn.textContent = "保存中...";
  try {
    const method = id ? "PUT" : "POST";
    const path = id ? `/api/records/${id}` : "/api/records";
    if (id) record.id = id;
    await api(method, path, record);
    closeForm();
    await loadRecords();
  } catch (e) {
    alert("保存失败: " + e.message);
  } finally {
    saveRecordBtn.disabled = false;
    saveRecordBtn.textContent = id ? "💾 更新记录" : "💾 保存记录";
  }
}

async function loadRecords() {
  try {
    const data = await api("GET", "/api/records");
    state.roleRecords = data.records || [];
    renderRecords(state.roleRecords);
    refreshChatContext();
  } catch { state.roleRecords = []; }
}

function renderRecords(records) {
  const list = document.getElementById("recordsList");
  const empty = document.getElementById("recordsEmpty");

  if (!records.length) {
    list.innerHTML = "";
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  list.innerHTML = records.map((r, i) => `
    <div class="recordCard">
      <div>
        <div class="recordMeta">
          <span class="recordScript">${esc(r.script)}</span>
          <span class="recordRoleName">· ${esc(r.role)}</span>
          <span class="recordRating">${"\u2605".repeat(Math.min(10, r.rating || 0))} ${r.rating || 0}</span>
        </div>
        ${r.tags?.length ? `<div class="recordTags">${r.tags.map(t => `<span class="recordTag">${esc(t)}</span>`).join("")}</div>` : ""}
        ${r.review ? `<div class="recordReview">${esc(r.review)}</div>` : ""}
      </div>
      <div class="recordActions">
        <button data-edit="${i}">✏️ 编辑</button>
        <button class="danger" data-del="${i}">🗑 删除</button>
      </div>
    </div>
  `).join("");

  list.querySelectorAll("[data-edit]").forEach(b => {
    b.addEventListener("click", () => {
      const rec = state.roleRecords[parseInt(b.dataset.edit)];
      openForm(rec);  // 编辑时打开表单
    });
  });
  list.querySelectorAll("[data-del]").forEach(b => {
    b.addEventListener("click", () => deleteRecord(state.roleRecords[parseInt(b.dataset.del)]));
  });
}

async function deleteRecord(r) {
  if (!confirm(`确定删除\u300C${r.script} - ${r.role}」吗？`)) return;
  try {
    await api("DELETE", `/api/records/${r.id}`);
    await loadRecords();
    // 如果正在编辑这条记录，关闭表单    if (val("editRecordId") === r.id) closeForm();
  } catch (e) {
    alert("删除失败: " + e.message);
  }
}

// ══════════════════ Chat ══════════════════

const chatBox = document.getElementById("chatBox");
const chatInput = document.getElementById("chatInput");
const chatSend = document.getElementById("chatSend");
const chatHistory = [];

chatSend.addEventListener("click", sendChat);
chatInput.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); }
});

// Clickable hints
document.querySelector(".chatHint")?.addEventListener("click", e => {
  const em = e.target.closest("em");
  if (!em) return;
  chatInput.value = em.textContent;
  sendChat();
});

async function sendChat() {
  const message = chatInput.value.trim();
  if (!message) return;

  appendBubble("user", message);
  chatInput.value = "";
  chatSend.disabled = true;
  chatSend.textContent = "思考中...";

  const persona = readPersona();

  try {
    const data = await api("POST", "/api/agent", {
      message,
      userProfile: persona,
      roleRecords: state.roleRecords,
      history: chatHistory.slice(-10)
    });

    chatHistory.push({ role: "user", content: message });
    chatHistory.push({ role: "assistant", content: data.reply });

    appendBubble("assistant", data.reply || "（Agent 未返回响应）");
    setStatus("Agent 已完成分析");
    refreshChatContext();
  } catch (err) {
    appendBubble("assistant", "\u2717 处理失败：\u201D" + err.message + "\n\n请确认已配置 OPENROUTER_API_KEY。");
  } finally {
    chatSend.disabled = false;
    chatSend.textContent = "发送";
  }
}

function appendBubble(role, text) {
  const div = document.createElement("div");
  div.className = `chatBubble ${role}`;
  // 先转义 HTML 再处理 Markdown，防止 XSS
  const escaped = text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  div.innerHTML = escaped
    .replace(/\n/g, "<br>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

// ── Chat Context Sidebar ──
function refreshChatContext() {
  const persona = readPersona();
  const hasPersona = persona.mbti || persona.zodiac || persona.gender || persona.preferredLines?.length;
  const ctxPersona = document.getElementById("ctxPersona");
  const ctxRecords = document.getElementById("ctxRecords");

  if (hasPersona) {
    const bits = [];
    if (persona.mbti) bits.push(`MBTI: ${persona.mbti}`);
    if (persona.zodiac) bits.push(`星座: ${persona.zodiac}`);
    if (persona.gender) bits.push(`性别: ${persona.gender}`);
    if (persona.crossGender !== "no") bits.push(`反串: ${persona.crossGender === "yes" ? "接受" : "可考虑"}`);
    if (persona.preferredLines?.length) bits.push(`偏好: ${persona.preferredLines.join("\u3001")}`);
    if (persona.avoidTags?.length) bits.push(`雷区: ${persona.avoidTags.join("\u3001")}`);
    ctxPersona.textContent = bits.join(" · ") || "已填写";
    ctxPersona.style.color = "var(--ink)";
  } else {
    ctxPersona.innerHTML = "<em>尚未填写用户画像</em>";
    ctxPersona.style.color = "";
  }

  if (state.roleRecords.length) {
    const lines = state.roleRecords.map(r => `路 ${esc(r.script)} 鈥?${esc(r.role)} (${esc(String(r.rating))}鍒?`);
    ctxRecords.innerHTML = lines.slice(0, 10).join("<br>");
    if (state.roleRecords.length > 10) ctxRecords.innerHTML += `<br><em>...还有 ${state.roleRecords.length - 10} /em>`;
    ctxRecords.style.color = "var(--ink)";
  } else {
    ctxRecords.innerHTML = "<em>暂无角色记录</em>";
    ctxRecords.style.color = "";
  }
}

// ══════════════════ Init ══════════════════
(async function init() {
  await loadPersona();
  await loadRecords();
  refreshChatContext();
  setStatus("就绪");
})();
