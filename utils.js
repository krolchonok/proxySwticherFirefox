const STORAGE_KEYS = {
  MASTER_PROXY_ENABLED: "masterProxyEnabled",
  GLOBAL_PROXY_ENABLED: "globalProxyEnabled",
  PROXY_PROFILES: "proxyProfiles",
  HOST_MAPPINGS: "hostMappings",
  DEFAULT_PROFILE_ID: "defaultProfileId",
  WHITELIST_HOSTS: "whitelistHosts"
};

const MESSAGES = {
  invalidUrl: "Некорректный URL!",
  emptyHost: "Поле хоста не может быть пустым!",
  storageError: "Ошибка доступа к хранилищу настроек.",
  profileNotFound: "(Профиль не найден)",
  hostExists: "Хост уже существует!",
  invalidPort: "Порт должен быть числом от 1 до 65535!"
};

const Storage = {
  get: async (key, defaultValue) => {
    try {
      const data = await chrome.storage.local.get(key);
      if (key === STORAGE_KEYS.PROXY_PROFILES || key === STORAGE_KEYS.HOST_MAPPINGS || key === STORAGE_KEYS.WHITELIST_HOSTS) {
        return Array.isArray(data[key]) ? data[key] : defaultValue || [];
      }
      if (key === STORAGE_KEYS.DEFAULT_PROFILE_ID) {
        return typeof data[key] === "string" ? data[key] : defaultValue || null;
      }
      if (key === STORAGE_KEYS.GLOBAL_PROXY_ENABLED) {
        return data[key] === true;
      }
      if (key === STORAGE_KEYS.MASTER_PROXY_ENABLED) {
        return data[key] !== false;
      }
      return data[key] !== undefined ? data[key] : defaultValue;
    } catch (e) {
      console.error(`Ошибка чтения из хранилища (${key}):`, e);
      return defaultValue;
    }
  },

  set: async (key, value) => {
    try {
      await chrome.storage.local.set({ [key]: value });
      return true;
    } catch (e) {
      console.error(`Ошибка записи в хранилище (${key}):`, e);
      return false;
    }
  }
};

function escapeHTML(str) {
  if (typeof str !== "string") return str;
  return str.replace(/[&<>"']/g, tag => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[tag]));
}

function debounce(func, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), delay);
  };
}

export { STORAGE_KEYS, MESSAGES, Storage, escapeHTML, debounce };