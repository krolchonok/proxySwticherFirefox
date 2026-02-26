const api = typeof browser !== "undefined" ? browser : chrome;

const STORAGE_KEYS = {
  MASTER_PROXY_ENABLED: "masterProxyEnabled",
  GLOBAL_PROXY_ENABLED: "globalProxyEnabled",
  PROXY_PROFILES: "proxyProfiles",
  HOST_MAPPINGS: "hostMappings",
  DEFAULT_PROFILE_ID: "defaultProfileId",
};

const UI = {
  masterProxyToggle: document.getElementById("masterProxyToggle"),
  globalProxyToggle: document.getElementById("globalProxyToggle"),
  hostList: document.getElementById("hostList"),
  addHostProfileSelect: document.getElementById("addHostProfileSelect"),
  hostInput: document.getElementById("hostInput"),
  addHostBtn: document.getElementById("addHostBtn"),
  addHostBtnUrl: document.getElementById("addHostBtnUrl"),
  addCurrentTabUrlBtn: document.getElementById("addCurrentTabUrlBtn"),
  openSettingsPageBtn: document.getElementById("openSettingsPage"),
  tabFilterInput: document.getElementById("tabFilterInput"),
  tabList: document.getElementById("tabList"),
  progressLabel: document.getElementById("progressLabel"),
  coverageProgressBar: document.getElementById("coverageProgressBar"),
};

const state = {
  masterEnabled: true,
  globalProxyEnabled: false,
  proxyProfiles: [],
  hostMappings: [],
  defaultProfileId: null,
};

async function readState() {
  const data = await api.storage.local.get(Object.values(STORAGE_KEYS));
  state.masterEnabled = data[STORAGE_KEYS.MASTER_PROXY_ENABLED] !== false;
  state.globalProxyEnabled = data[STORAGE_KEYS.GLOBAL_PROXY_ENABLED] === true;
  state.proxyProfiles = Array.isArray(data[STORAGE_KEYS.PROXY_PROFILES])
    ? data[STORAGE_KEYS.PROXY_PROFILES]
    : [];
  state.hostMappings = Array.isArray(data[STORAGE_KEYS.HOST_MAPPINGS])
    ? data[STORAGE_KEYS.HOST_MAPPINGS]
    : [];
  state.defaultProfileId =
    typeof data[STORAGE_KEYS.DEFAULT_PROFILE_ID] === "string"
      ? data[STORAGE_KEYS.DEFAULT_PROFILE_ID]
      : null;
}

async function writeStorage(key, value) {
  await api.storage.local.set({ [key]: value });
}

function getProfileName(profileId) {
  if (!profileId) {
    const defaultProfile = state.proxyProfiles.find(
      (profile) => profile.id === state.defaultProfileId
    );
    return defaultProfile ? `По умолчанию (${defaultProfile.name})` : "По умолчанию";
  }

  const profile = state.proxyProfiles.find((item) => item.id === profileId);
  return profile ? profile.name : "(Профиль не найден)";
}

function populateProfileSelect() {
  UI.addHostProfileSelect.innerHTML = "";

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "Профиль по умолчанию";
  UI.addHostProfileSelect.appendChild(defaultOption);

  for (const profile of state.proxyProfiles) {
    const option = document.createElement("option");
    option.value = profile.id;
    option.textContent = profile.name;
    UI.addHostProfileSelect.appendChild(option);
  }
}

function renderHostMappings() {
  UI.hostList.innerHTML = "";

  if (state.hostMappings.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Нет проксируемых хостов";
    li.style.fontStyle = "italic";
    li.style.color = "#777";
    li.style.justifyContent = "center";
    UI.hostList.appendChild(li);
    return;
  }

  for (const mapping of state.hostMappings) {
    const li = document.createElement("li");

    const hostSpan = document.createElement("span");
    hostSpan.className = "host-name";
    hostSpan.textContent = mapping.host;
    li.appendChild(hostSpan);

    const profileSelect = document.createElement("select");
    profileSelect.className = "host-profile-select";

    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = getProfileName(null);
    profileSelect.appendChild(defaultOption);

    for (const profile of state.proxyProfiles) {
      const option = document.createElement("option");
      option.value = profile.id;
      option.textContent = profile.name;
      profileSelect.appendChild(option);
    }

    profileSelect.value = mapping.profileId || "";
    profileSelect.addEventListener("change", async (event) => {
      const newProfileId = event.target.value || null;
      await updateMappingProfile(mapping.host, newProfileId);
    });

    li.appendChild(profileSelect);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn-danger btn-sm";
    deleteBtn.textContent = "Удалить";
    deleteBtn.addEventListener("click", async () => {
      await removeHost(mapping.host);
    });

    li.appendChild(deleteBtn);
    UI.hostList.appendChild(li);
  }
}

function normalizeHost(host) {
  return String(host || "").trim().toLowerCase();
}

function extractHostFromUrl(url) {
  if (!url) {
    return null;
  }

  try {
    return normalizeHost(new URL(url).hostname);
  } catch (_error) {
    return null;
  }
}

function isHostCoveredByMapping(host) {
  if (!host) {
    return false;
  }

  return state.hostMappings.some((mapping) => {
    const mappedHost = normalizeHost(mapping.host);
    return host === mappedHost || host.endsWith(`.${mappedHost}`);
  });
}

function updateCoverageProgress(tabs) {
  const hosts = tabs
    .map((tab) => extractHostFromUrl(tab.url))
    .filter(Boolean);

  const total = hosts.length;
  const covered = hosts.filter((host) => isHostCoveredByMapping(host)).length;
  const percent = total === 0 ? 0 : Math.round((covered / total) * 100);

  UI.progressLabel.textContent = `Покрытие вкладок: ${covered}/${total}`;
  UI.coverageProgressBar.style.width = `${percent}%`;
}

async function addHostMapping(host, profileId) {
  const normalizedHost = normalizeHost(host);
  if (!normalizedHost) {
    alert("Поле хоста не может быть пустым");
    return;
  }

  if (state.hostMappings.some((mapping) => mapping.host === normalizedHost)) {
    alert(`Хост "${normalizedHost}" уже есть в списке`);
    return;
  }

  const updated = [...state.hostMappings, { host: normalizedHost, profileId: profileId || null }];
  await writeStorage(STORAGE_KEYS.HOST_MAPPINGS, updated);
}

async function updateMappingProfile(host, profileId) {
  const updated = state.hostMappings.map((mapping) =>
    mapping.host === host ? { ...mapping, profileId } : mapping
  );
  await writeStorage(STORAGE_KEYS.HOST_MAPPINGS, updated);
}

async function removeHost(host) {
  const updated = state.hostMappings.filter((mapping) => mapping.host !== host);
  await writeStorage(STORAGE_KEYS.HOST_MAPPINGS, updated);
}

async function addHostFromInput() {
  const selectedProfileId = UI.addHostProfileSelect.value || null;
  await addHostMapping(UI.hostInput.value, selectedProfileId);
  UI.hostInput.value = "";
}

async function addHostFromUrl() {
  const input = String(UI.hostInput.value || "").trim();
  if (!input) {
    alert("Введите URL");
    return;
  }

  try {
    const url = new URL(input);
    const selectedProfileId = UI.addHostProfileSelect.value || null;
    await addHostMapping(url.hostname, selectedProfileId);
    UI.hostInput.value = "";
  } catch (_error) {
    alert("Некорректный URL");
  }
}

async function addCurrentTabHost() {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) {
    alert("Не удалось получить URL текущей вкладки");
    return;
  }

  try {
    const selectedProfileId = UI.addHostProfileSelect.value || null;
    const hostname = new URL(tab.url).hostname;
    await addHostMapping(hostname, selectedProfileId);
  } catch (_error) {
    alert("URL текущей вкладки не поддерживается");
  }
}

function getDisplayTitle(tab) {
  if (tab.title && tab.title.trim() !== "") {
    return tab.title;
  }

  if (tab.url) {
    return tab.url;
  }

  return `Вкладка #${tab.id}`;
}

async function renderTabs() {
  UI.tabList.innerHTML = "";

  const query = String(UI.tabFilterInput.value || "").trim().toLowerCase();
  const tabs = await api.tabs.query({ currentWindow: true });
  updateCoverageProgress(tabs);
  const filteredTabs = tabs.filter((tab) => {
    const title = String(tab.title || "").toLowerCase();
    const url = String(tab.url || "").toLowerCase();
    return query === "" || title.includes(query) || url.includes(query);
  });

  if (filteredTabs.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Нет вкладок по фильтру";
    li.style.fontStyle = "italic";
    li.style.color = "#777";
    UI.tabList.appendChild(li);
    return;
  }

  for (const tab of filteredTabs.slice(0, 20)) {
    const li = document.createElement("li");

    const title = document.createElement("span");
    title.className = "host-name";
    title.textContent = getDisplayTitle(tab);
    li.appendChild(title);

    const addButton = document.createElement("button");
    addButton.className = "btn btn-info btn-sm";
    addButton.textContent = "Добавить хост";
    addButton.addEventListener("click", async () => {
      if (!tab.url) {
        return;
      }
      try {
        const host = new URL(tab.url).hostname;
        const selectedProfileId = UI.addHostProfileSelect.value || null;
        await addHostMapping(host, selectedProfileId);
      } catch (_error) {
        alert("Эту вкладку нельзя обработать");
      }
    });

    li.appendChild(addButton);
    UI.tabList.appendChild(li);
  }
}

function bindEvents() {
  UI.addHostBtn.addEventListener("click", addHostFromInput);
  UI.addHostBtnUrl.addEventListener("click", addHostFromUrl);
  UI.addCurrentTabUrlBtn.addEventListener("click", addCurrentTabHost);

  UI.masterProxyToggle.addEventListener("change", async (event) => {
    await writeStorage(STORAGE_KEYS.MASTER_PROXY_ENABLED, event.target.checked);
  });

  UI.globalProxyToggle.addEventListener("change", async (event) => {
    await writeStorage(STORAGE_KEYS.GLOBAL_PROXY_ENABLED, event.target.checked);
  });

  UI.hostInput.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addHostFromInput();
    }
  });

  UI.tabFilterInput.addEventListener("input", () => {
    renderTabs().catch((error) => {
      console.error("Failed to render tabs", error);
    });
  });

  UI.openSettingsPageBtn.addEventListener("click", () => {
    api.runtime.openOptionsPage();
  });

  api.tabs.onUpdated.addListener(() => {
    renderTabs().catch(() => {});
  });

  api.tabs.onRemoved.addListener(() => {
    renderTabs().catch(() => {});
  });

  api.tabs.onCreated.addListener(() => {
    renderTabs().catch(() => {});
  });

  api.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName !== "local") {
      return;
    }

    const tracked = Object.values(STORAGE_KEYS);
    const hasRelevantChange = Object.keys(changes).some((key) => tracked.includes(key));
    if (!hasRelevantChange) {
      return;
    }

    await refreshUi();
  });
}

async function refreshUi() {
  await readState();
  UI.masterProxyToggle.checked = state.masterEnabled;
  UI.globalProxyToggle.checked = state.globalProxyEnabled;
  populateProfileSelect();
  renderHostMappings();
  await renderTabs();
}

async function init() {
  bindEvents();
  await refreshUi();
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((error) => {
    console.error("Popup init failed", error);
  });
});
