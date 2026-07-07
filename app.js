(function () {
  const STORAGE_KEY = "babybingo-pwa-state-v3";
  const LEGACY_KEYS = ["babybingo-pwa-state-v2", "babybingo-pwa-state-v1"];
  const config = {
    url: "",
    anonKey: "",
    bucket: "babybingo-photos",
    stateTable: "babybingo_state",
    appId: "babybingo",
    ...(window.BABYBINGO_SUPABASE || {})
  };

  const drawTypeLabels = {
    daily: "日常小抽",
    romantic: "浪漫一抽",
    thunder: "雷霆大抽"
  };

  const defaultPrizePools = {
    daily: [
      { id: uid(), title: "一杯美味咖", desc: "瑞迪或者库迪，今天兑换" },
      { id: uid(), title: "一杯美味茶", desc: "她指哪家就哪家" },
      { id: uid(), title: "一根美味肠", desc: "外面脆脆的，里面嫩嫩的" }
    ],
    romantic: [
      { id: uid(), title: "夸夸三连", desc: "认真说出对方三个可爱的地方" },
      { id: uid(), title: "散步 30 分钟", desc: "一起出门走走，顺便聊点轻松的" },
      { id: uid(), title: "今晚抱抱券", desc: "兑换一个长长的抱抱" }
    ],
    thunder: [
      { id: uid(), title: "周末约会选择权", desc: "本周末去哪玩由中奖的人决定" },
      { id: uid(), title: "小礼物基金", desc: "给对方准备一个小惊喜" },
      { id: uid(), title: "免家务一次", desc: "今天的一项家务由另一个人承包" }
    ]
  };

  const defaultState = {
    prizePools: clone(defaultPrizePools),
    drawRecords: [],
    journals: [],
    photos: []
  };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  let state = loadState();
  let currentPhotoId = null;
  let deferredInstallPrompt = null;
  let remoteSaveTimer = null;
  let remote = {
    ready: false,
    loading: false,
    client: null,
    status: "Supabase 未配置，当前使用本地模式。"
  };

  function uid() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function isConfigured() {
    return (
      config.url &&
      config.anonKey &&
      !config.url.includes("你的项目") &&
      !config.anonKey.includes("你的")
    );
  }

  function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        return normalizeState(JSON.parse(raw));
      } catch {
        return clone(defaultState);
      }
    }

    for (const key of LEGACY_KEYS) {
      const legacyRaw = localStorage.getItem(key);
      if (!legacyRaw) continue;

      try {
        const legacy = JSON.parse(legacyRaw);
        return normalizeState({
          ...legacy,
          journals: legacy.journals || legacy.diaries || [],
          photos: legacy.photos || []
        });
      } catch {
        continue;
      }
    }

    return clone(defaultState);
  }

  function normalizeState(nextState) {
    const base = clone(defaultState);
    return {
      prizePools: {
        daily: Array.isArray(nextState?.prizePools?.daily) ? nextState.prizePools.daily : base.prizePools.daily,
        romantic: Array.isArray(nextState?.prizePools?.romantic) ? nextState.prizePools.romantic : base.prizePools.romantic,
        thunder: Array.isArray(nextState?.prizePools?.thunder) ? nextState.prizePools.thunder : base.prizePools.thunder
      },
      drawRecords: Array.isArray(nextState?.drawRecords) ? nextState.drawRecords : [],
      journals: normalizeCommentableItems(nextState?.journals),
      photos: normalizeCommentableItems(nextState?.photos)
    };
  }

  function normalizeCommentableItems(items) {
    if (!Array.isArray(items)) return [];
    return items.map((item) => ({
      ...item,
      comments: Array.isArray(item.comments) ? item.comments : []
    }));
  }

  function saveLocalState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function saveState() {
    saveLocalState();
    render();
    scheduleRemoteSave();
  }

  function formatDate(value, withTime = true) {
    const options = withTime
      ? { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }
      : { year: "numeric", month: "2-digit", day: "2-digit" };
    return new Intl.DateTimeFormat("zh-CN", options).format(new Date(value));
  }

  function setText(selector, text) {
    const element = $(selector);
    if (element) element.textContent = text;
  }

  function emptyNode(text = "还没有内容") {
    const node = $("#emptyTemplate").content.firstElementChild.cloneNode(true);
    node.textContent = text;
    return node;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replaceAll("`", "&#096;");
  }

  function setView(name) {
    $$(".view").forEach((view) => view.classList.toggle("is-active", view.dataset.view === name));
    $$(".tab").forEach((tab) => tab.classList.toggle("is-active", tab.dataset.tab === name));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function render() {
    renderHome();
    renderDrawRecords();
    renderJournals();
    renderPhotos();
    renderSettingsPrizes();
  }

  function renderHome() {
    renderHomePhoto();
    renderHomeJournals();
  }

  function renderHomeJournals() {
    const list = $("#homeJournalList");
    list.innerHTML = "";
    const todayKey = new Date().toDateString();
    const todayItems = state.journals.filter((item) => new Date(item.createdAt).toDateString() === todayKey);
    const source = todayItems.length ? todayItems : state.journals.slice(0, 2);

    if (!source.length) {
      list.appendChild(emptyNode("今天还没有手帐，写一条吧"));
      return;
    }

    for (const item of source.slice(0, 2)) {
      list.appendChild(createJournalCard(item, false));
    }
  }

  function drawPrize(type) {
    const pool = state.prizePools[type] || [];
    if (!pool.length) {
      window.alert(`${drawTypeLabels[type]} 的奖池还是空的，先去设置里加一个奖项吧。`);
      return;
    }

    const prize = pool[Math.floor(Math.random() * pool.length)];
    const record = {
      id: uid(),
      type,
      title: prize.title,
      desc: prize.desc || "",
      createdAt: nowIso(),
      redeemed: false,
      redeemedAt: null
    };

    state.drawRecords.unshift(record);
    state.drawRecords = state.drawRecords.slice(0, 80);
    setText("#drawResultTitle", record.title);
    setText("#drawResultDesc", record.desc || drawTypeLabels[type]);
    $("#drawResultPanel").hidden = false;
    saveState();
  }

  function renderDrawRecords() {
    setText("#drawRecordCount", `${state.drawRecords.length} 条`);
    const list = $("#drawRecordList");
    list.innerHTML = "";

    if (!state.drawRecords.length) {
      list.appendChild(emptyNode("还没有抽奖记录"));
      return;
    }

    for (const record of state.drawRecords) {
      const item = document.createElement("article");
      item.className = "item-card";
      item.innerHTML = `
        <header>
          <div>
            <span class="meta">${drawTypeLabels[record.type] || "抽奖"} · ${formatDate(record.createdAt)}</span>
            <h3>${escapeHtml(record.title)}</h3>
          </div>
          <span class="badge ${record.redeemed ? "is-done" : ""}">${record.redeemed ? "已兑换" : "待兑换"}</span>
        </header>
        <p>${escapeHtml(record.desc || "没有说明")}</p>
        <footer>
          <span class="meta">${record.redeemed ? `兑换于 ${formatDate(record.redeemedAt)}` : "兑换后不可改回未兑换"}</span>
          ${record.redeemed ? "" : `<button class="tiny-button" type="button" data-redeem-record="${record.id}">标记已兑换</button>`}
        </footer>
      `;
      list.appendChild(item);
    }
  }

  function redeemRecord(id) {
    const record = state.drawRecords.find((item) => item.id === id);
    if (!record || record.redeemed) return;
    record.redeemed = true;
    record.redeemedAt = nowIso();
    saveState();
  }

  function saveJournal(event) {
    event.preventDefault();
    const title = $("#journalTitle").value.trim();
    const text = $("#journalText").value.trim();
    if (!title || !text) return;

    state.journals.unshift({
      id: uid(),
      title,
      text,
      createdAt: nowIso(),
      comments: []
    });
    state.journals = state.journals.slice(0, 120);
    $("#journalTitle").value = "";
    $("#journalText").value = "";
    saveState();
    setView("home");
  }

  function renderJournals() {
    setText("#journalCount", `${state.journals.length} 篇`);
    const list = $("#journalList");
    list.innerHTML = "";

    if (!state.journals.length) {
      list.appendChild(emptyNode("还没有小手帐"));
      return;
    }

    for (const item of state.journals) {
      list.appendChild(createJournalCard(item, true));
    }
  }

  function createJournalCard(item, withActions) {
    const card = document.createElement("article");
    card.className = "item-card";
    card.innerHTML = `
      <header>
        <div>
          <span class="meta">${formatDate(item.createdAt)}</span>
          <h3>${escapeHtml(item.title)}</h3>
        </div>
        ${withActions ? `<button class="tiny-button" type="button" data-delete-journal="${item.id}">删除</button>` : ""}
      </header>
      <p>${escapeHtml(item.text)}</p>
      ${withActions ? renderComments("journal", item) : ""}
    `;
    return card;
  }

  function deleteJournal(id) {
    state.journals = state.journals.filter((item) => item.id !== id);
    saveState();
  }

  function renderComments(type, item) {
    const comments = Array.isArray(item.comments) ? item.comments : [];
    const title = comments.length ? "追评" : "还没有追评";
    return `
      <section class="comment-box">
        <div class="comment-title">${title}</div>
        <div class="comment-list">
          ${
            comments.length
              ? comments
                  .map(
                    (comment) => `
                      <article class="comment-item">
                        <p>${escapeHtml(comment.text)}</p>
                        <span>${formatDate(comment.createdAt)}</span>
                      </article>
                    `
                  )
                  .join("")
              : `<p class="comment-empty">可以补一句当时的想法</p>`
          }
        </div>
        <form class="comment-form" data-comment-type="${type}" data-comment-id="${item.id}">
          <input maxlength="80" placeholder="写一条追评" />
          <button type="submit">发送</button>
        </form>
      </section>
    `;
  }

  function addComment(type, id, text) {
    const source = type === "photo" ? state.photos : state.journals;
    const item = source.find((entry) => entry.id === id);
    if (!item) return;

    if (!Array.isArray(item.comments)) item.comments = [];
    item.comments.push({
      id: uid(),
      text,
      createdAt: nowIso()
    });
    saveState();
  }

  function handleCommentSubmit(event) {
    const form = event.target.closest("[data-comment-type][data-comment-id]");
    if (!form) return;
    event.preventDefault();
    event.stopPropagation();

    const input = form.querySelector("input");
    const text = input.value.trim();
    if (!text) return;

    addComment(form.dataset.commentType, form.dataset.commentId, text);
  }

  function getCurrentPhoto() {
    if (!state.photos.length) return null;
    const existing = state.photos.find((photo) => photo.id === currentPhotoId);
    if (existing) return existing;
    const nextPhoto = state.photos[Math.floor(Math.random() * state.photos.length)];
    currentPhotoId = nextPhoto.id;
    return nextPhoto;
  }

  function pickRandomPhoto(event) {
    event?.stopPropagation();
    if (!state.photos.length) {
      currentPhotoId = null;
      render();
      return;
    }

    const nextPhoto = state.photos[Math.floor(Math.random() * state.photos.length)];
    currentPhotoId = nextPhoto.id;
    render();
  }

  function renderPhotoImage(imageSelector, emptySelector, photo) {
    const image = $(imageSelector);
    const empty = $(emptySelector);

    if (!photo?.url) {
      image.hidden = true;
      image.removeAttribute("src");
      empty.hidden = false;
      return;
    }

    image.src = photo.url;
    image.dataset.photoId = photo.id;
    image.hidden = false;
    empty.hidden = true;
  }

  function openPhotoPreview(photo) {
    if (!photo?.url) return;
    $("#photoPreviewImage").src = photo.url;
    $("#photoPreviewCaption").textContent = photo.caption || "未命名照片";
    $("#photoPreview").hidden = false;
  }

  function openCurrentPhotoPreview(event) {
    event?.stopPropagation();
    openPhotoPreview(getCurrentPhoto());
  }

  function closePhotoPreview() {
    $("#photoPreview").hidden = true;
    $("#photoPreviewImage").removeAttribute("src");
  }

  function renderHomePhoto() {
    const photo = getCurrentPhoto();
    renderPhotoImage("#homePhotoImage", "#homePhotoEmpty", photo);
    setText("#homePhotoTitle", photo?.caption || "随机展示一张照片");
  }

  function renderPhotos() {
    setText("#photoCount", `${state.photos.length} 张`);
    setText("#photoSyncStatus", remote.status);
    const photo = getCurrentPhoto();
    renderPhotoImage("#photoDetailImage", "#photoDetailEmpty", photo);

    const list = $("#photoList");
    list.innerHTML = "";

    if (!state.photos.length) {
      list.appendChild(emptyNode("还没有上传照片"));
      return;
    }

    for (const item of state.photos) {
      const card = document.createElement("article");
      card.className = "photo-list-card";
      card.innerHTML = `
        <img src="${escapeAttr(item.url)}" alt="${escapeAttr(item.caption || "照片")}" />
        <div>
          <h3>${escapeHtml(item.caption || "未命名照片")}</h3>
          <span class="meta">${formatDate(item.createdAt)} · ${item.source === "supabase" ? "云端" : "本地"}</span>
        </div>
        ${renderComments("photo", item)}
      `;
      card.addEventListener("click", (event) => {
        if (event.target.closest(".comment-box")) return;
        currentPhotoId = item.id;
        render();
        setView("photos");
      });
      list.appendChild(card);
    }
  }

  async function setupSupabase() {
    if (!isConfigured()) {
      remote.status = "Supabase 未配置，当前使用本地模式。填好 supabase-config.js 后即可云同步。";
      renderPhotos();
      return;
    }

    if (!window.supabase?.createClient) {
      remote.status = "Supabase SDK 未加载，请检查网络或 index.html 里的 SDK 地址。";
      renderPhotos();
      return;
    }

    remote.loading = true;
    remote.status = "正在连接 Supabase...";
    renderPhotos();

    try {
      remote.client = window.supabase.createClient(config.url, config.anonKey);
      const { data, error } = await remote.client
        .from(config.stateTable)
        .select("data")
        .eq("app_id", config.appId)
        .maybeSingle();

      if (error) throw error;
      if (data?.data) {
        state = normalizeState(data.data);
        saveLocalState();
      }

      remote.ready = true;
      remote.status = "Supabase 已连接，数据会自动云同步。";
      render();

      if (!data?.data) {
        await persistRemoteState();
      }
    } catch (error) {
      remote.ready = false;
      remote.status = `Supabase 连接失败，当前使用本地模式：${error.message || error}`;
      renderPhotos();
    } finally {
      remote.loading = false;
    }
  }

  function scheduleRemoteSave() {
    if (!remote.ready || !remote.client) return;
    window.clearTimeout(remoteSaveTimer);
    remoteSaveTimer = window.setTimeout(() => {
      persistRemoteState();
    }, 500);
  }

  async function persistRemoteState() {
    if (!remote.ready || !remote.client) return;
    const { error } = await remote.client
      .from(config.stateTable)
      .upsert(
        {
          app_id: config.appId,
          data: state,
          updated_at: nowIso()
        },
        { onConflict: "app_id" }
      );

    if (error) {
      remote.status = `Supabase 保存失败：${error.message || error}`;
      renderPhotos();
      return;
    }

    remote.status = "Supabase 已同步。";
    renderPhotos();
  }

  async function uploadPhoto(event) {
    event.preventDefault();
    const fileInput = $("#photoFile");
    const captionInput = $("#photoCaption");
    const button = $("#photoUploadButton");
    const file = fileInput.files?.[0];

    if (!file) {
      window.alert("先选择一张照片。");
      return;
    }

    if (!file.type.startsWith("image/")) {
      window.alert("只能上传图片文件。");
      return;
    }

    button.disabled = true;
    button.textContent = "上传中...";

    try {
      const caption = captionInput.value.trim() || "甜甜照片";
      const photo = remote.ready
        ? await uploadSupabasePhoto(file, caption)
        : await createLocalPhoto(file, caption);

      state.photos.unshift(photo);
      state.photos = state.photos.slice(0, 120);
      currentPhotoId = photo.id;
      fileInput.value = "";
      captionInput.value = "";
      saveState();
    } catch (error) {
      window.alert(`上传失败：${error.message || error}`);
    } finally {
      button.disabled = false;
      button.textContent = "上传照片";
    }
  }

  async function uploadSupabasePhoto(file, caption) {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${config.appId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await remote.client.storage
      .from(config.bucket)
      .upload(path, file, {
        cacheControl: "3600",
        contentType: file.type || undefined,
        upsert: false
      });

    if (error) throw new Error(`Supabase Storage 上传失败：${error.message || error}`);

    const { data } = remote.client.storage.from(config.bucket).getPublicUrl(path);
    return {
      id: uid(),
      storagePath: path,
      url: data.publicUrl,
      caption,
      createdAt: nowIso(),
      source: "supabase",
      comments: []
    };
  }

  function createLocalPhoto(file, caption) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          id: uid(),
          url: reader.result,
          caption,
          createdAt: nowIso(),
          source: "local",
          comments: []
        });
      };
      reader.onerror = () => reject(new Error("读取本地图片失败"));
      reader.readAsDataURL(file);
    });
  }

  function savePrize(event) {
    event.preventDefault();
    const type = $("#prizeType").value;
    const title = $("#prizeTitle").value.trim();
    const desc = $("#prizeDesc").value.trim();
    if (!title) return;

    state.prizePools[type].unshift({
      id: uid(),
      title,
      desc
    });
    $("#prizeTitle").value = "";
    $("#prizeDesc").value = "";
    saveState();
  }

  function renderSettingsPrizes() {
    const list = $("#settingsPrizeList");
    list.innerHTML = "";

    for (const type of Object.keys(drawTypeLabels)) {
      const group = document.createElement("section");
      group.className = "prize-group";
      group.innerHTML = `<h3>${drawTypeLabels[type]}</h3>`;
      const items = state.prizePools[type] || [];

      if (!items.length) {
        group.appendChild(emptyNode("这个奖池还没有奖项"));
      }

      for (const prize of items) {
        const card = document.createElement("article");
        card.className = "item-card compact";
        card.innerHTML = `
          <header>
            <div>
              <h3>${escapeHtml(prize.title)}</h3>
              <p>${escapeHtml(prize.desc || "没有说明")}</p>
            </div>
            <button class="tiny-button" type="button" data-delete-prize="${type}:${prize.id}">删除</button>
          </header>
        `;
        group.appendChild(card);
      }

      list.appendChild(group);
    }
  }

  function deletePrize(value) {
    const [type, id] = value.split(":");
    state.prizePools[type] = state.prizePools[type].filter((item) => item.id !== id);
    saveState();
  }

  function resetPrizes() {
    if (!window.confirm("确定恢复默认奖池吗？当前自定义奖池会被覆盖。")) return;
    state.prizePools = clone(defaultPrizePools);
    saveState();
  }

  function setupPwa() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js");
    }

    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
      $("#installButton").hidden = false;
    });

    $("#installButton").addEventListener("click", () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      deferredInstallPrompt = null;
      $("#installButton").hidden = true;
    });
  }

  function bindEvents() {
    $$(".tab").forEach((tab) => tab.addEventListener("click", () => setView(tab.dataset.tab)));
    $$("[data-goto]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.goto)));
    $$("[data-draw-type]").forEach((button) => {
      button.addEventListener("click", () => drawPrize(button.dataset.drawType));
    });

    $("#drawRecordList").addEventListener("click", (event) => {
      const id = event.target.dataset.redeemRecord;
      if (id) redeemRecord(id);
    });

    $("#journalForm").addEventListener("submit", saveJournal);
    $("#journalList").addEventListener("click", (event) => {
      const id = event.target.dataset.deleteJournal;
      if (id) deleteJournal(id);
    });
    $("#journalList").addEventListener("submit", handleCommentSubmit);

    $("#homeRefreshPhotoButton").addEventListener("click", pickRandomPhoto);
    $("#refreshPhotoButton").addEventListener("click", pickRandomPhoto);
    $("#homePhotoImage").addEventListener("click", openCurrentPhotoPreview);
    $("#photoDetailImage").addEventListener("click", openCurrentPhotoPreview);
    $("#photoPreviewClose").addEventListener("click", closePhotoPreview);
    $("#photoPreview").addEventListener("click", (event) => {
      if (event.target.id === "photoPreview") closePhotoPreview();
    });
    $("#photoForm").addEventListener("submit", uploadPhoto);
    $("#photoList").addEventListener("submit", handleCommentSubmit);
    $("#prizeForm").addEventListener("submit", savePrize);
    $("#resetPrizesButton").addEventListener("click", resetPrizes);
    $("#settingsPrizeList").addEventListener("click", (event) => {
      const value = event.target.dataset.deletePrize;
      if (value) deletePrize(value);
    });
  }

  bindEvents();
  setupPwa();
  render();
  setupSupabase();
})();
