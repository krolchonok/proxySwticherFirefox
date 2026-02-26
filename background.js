const api = typeof browser !== "undefined" ? browser : chrome;

const STORAGE_PROXY_PROFILES = "proxyProfiles";
const STORAGE_HOST_MAPPINGS = "hostMappings";
const STORAGE_DEFAULT_PROFILE_ID = "defaultProfileId";
const STORAGE_WHITELIST_HOSTS = "whitelistHosts";
const STORAGE_GLOBAL_PROXY_ENABLED = "globalProxyEnabled";
const STORAGE_MASTER_PROXY_ENABLED = "masterProxyEnabled";

const STORAGE_KEYS = [
  STORAGE_PROXY_PROFILES,
  STORAGE_HOST_MAPPINGS,
  STORAGE_DEFAULT_PROFILE_ID,
  STORAGE_WHITELIST_HOSTS,
  STORAGE_GLOBAL_PROXY_ENABLED,
  STORAGE_MASTER_PROXY_ENABLED,
];

const DEFAULT_STATE = {
  profiles: [],
  mappings: [],
  defaultProfileId: null,
  whitelist: [],
  globalProxyEnabled: false,
  masterEnabled: true,
};

let state = { ...DEFAULT_STATE };

function isValidPort(port) {
  return Number.isInteger(port) && port > 0 && port <= 65535;
}

function normalizeProfileType(type) {
  const normalized = String(type || "").toLowerCase();
  if (normalized === "https") return "https";
  if (normalized === "socks" || normalized === "socks5") return "socks";
  if (normalized === "socks4") return "socks4";
  return "http";
}

function normalizeProfile(profile) {
  if (!profile || typeof profile !== "object") {
    return null;
  }

  const host = String(profile.host || "").trim();
  const id = String(profile.id || "").trim();
  const name = String(profile.name || "").trim();
  const port = Number(profile.port);

  if (!id || !name || !host || !isValidPort(port)) {
    return null;
  }

  return {
    id,
    name,
    host,
    port,
    type: normalizeProfileType(profile.type),
  };
}

function normalizeMapping(mapping, profileMap) {
  if (!mapping || typeof mapping !== "object") {
    return null;
  }

  const host = String(mapping.host || "").trim().toLowerCase();
  if (!host) {
    return null;
  }

  const profileIdValue = mapping.profileId;
  const profileId =
    typeof profileIdValue === "string" && profileIdValue.trim() !== ""
      ? profileIdValue.trim()
      : null;

  if (profileId && !profileMap.has(profileId)) {
    return null;
  }

  return { host, profileId };
}

function normalizeWhitelistEntry(entry) {
  return String(entry || "").trim().toLowerCase();
}

function isIPv4(value) {
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(value);
}

function matchesWhitelist(host, whitelistEntry) {
  if (!host || !whitelistEntry) {
    return false;
  }

  if (host === whitelistEntry) {
    return true;
  }

  if (!isIPv4(host) && !host.includes(":")) {
    return host.endsWith(`.${whitelistEntry}`);
  }

  if (/^(\d{1,3}\.){3}0\/24$/.test(whitelistEntry) && isIPv4(host)) {
    const [baseIp] = whitelistEntry.split("/");
    const baseParts = baseIp.split(".");
    const hostParts = host.split(".");
    return (
      baseParts[0] === hostParts[0] &&
      baseParts[1] === hostParts[1] &&
      baseParts[2] === hostParts[2]
    );
  }

  return false;
}

function resolveProfileForHost(host, mappingMap, profileMap, defaultProfileId) {
  const directHit = mappingMap.get(host);
  if (directHit) {
    return directHit.profileId ? profileMap.get(directHit.profileId) : profileMap.get(defaultProfileId) || null;
  }

  let bestMatch = null;
  for (const [mappedHost, mappedRule] of mappingMap.entries()) {
    if (host !== mappedHost && host.endsWith(`.${mappedHost}`)) {
      if (!bestMatch || mappedHost.length > bestMatch.host.length) {
        bestMatch = { host: mappedHost, rule: mappedRule };
      }
    }
  }

  if (!bestMatch) {
    return null;
  }

  if (!bestMatch.rule.profileId) {
    return profileMap.get(defaultProfileId) || null;
  }

  return profileMap.get(bestMatch.rule.profileId) || null;
}

function toFirefoxProxyInfo(profile) {
  if (!profile) {
    return { type: "direct" };
  }

  return {
    type: profile.type,
    host: profile.host,
    port: profile.port,
    proxyDNS: profile.type === "socks" || profile.type === "socks4",
  };
}

function findProxyForRequest(requestInfo) {
  if (!state.masterEnabled) {
    return { type: "direct" };
  }

  let host;
  try {
    host = new URL(requestInfo.url).hostname.toLowerCase();
  } catch (error) {
    return { type: "direct" };
  }

  for (const whitelistEntry of state.whitelist) {
    if (matchesWhitelist(host, whitelistEntry)) {
      return { type: "direct" };
    }
  }

  const profileFromRule = resolveProfileForHost(
    host,
    state.mappingMap,
    state.profileMap,
    state.defaultProfileId
  );

  if (profileFromRule) {
    return toFirefoxProxyInfo(profileFromRule);
  }

  if (state.globalProxyEnabled && state.defaultProfileId) {
    const defaultProfile = state.profileMap.get(state.defaultProfileId);
    if (defaultProfile) {
      return toFirefoxProxyInfo(defaultProfile);
    }
  }

  return { type: "direct" };
}

async function loadStateFromStorage() {
  const stored = await api.storage.local.get(STORAGE_KEYS);

  const profiles = Array.isArray(stored[STORAGE_PROXY_PROFILES])
    ? stored[STORAGE_PROXY_PROFILES].map(normalizeProfile).filter(Boolean)
    : [];

  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));

  const rawMappings = Array.isArray(stored[STORAGE_HOST_MAPPINGS])
    ? stored[STORAGE_HOST_MAPPINGS]
    : [];
  const mappings = rawMappings
    .map((mapping) => normalizeMapping(mapping, profileMap))
    .filter(Boolean);

  const mappingMap = new Map(mappings.map((mapping) => [mapping.host, mapping]));

  const defaultProfileIdRaw = stored[STORAGE_DEFAULT_PROFILE_ID];
  const defaultProfileId =
    typeof defaultProfileIdRaw === "string" && profileMap.has(defaultProfileIdRaw)
      ? defaultProfileIdRaw
      : null;

  const whitelist = Array.isArray(stored[STORAGE_WHITELIST_HOSTS])
    ? stored[STORAGE_WHITELIST_HOSTS]
        .map(normalizeWhitelistEntry)
        .filter((entry) => entry !== "")
    : [];

  state = {
    profiles,
    profileMap,
    mappings,
    mappingMap,
    defaultProfileId,
    whitelist,
    globalProxyEnabled: stored[STORAGE_GLOBAL_PROXY_ENABLED] === true,
    masterEnabled: stored[STORAGE_MASTER_PROXY_ENABLED] !== false,
  };
}

function handleStorageChanges(changes, areaName) {
  if (areaName !== "local") {
    return;
  }

  const changedKeys = Object.keys(changes);
  if (!changedKeys.some((key) => STORAGE_KEYS.includes(key))) {
    return;
  }

  loadStateFromStorage().catch((error) => {
    console.error("Failed to refresh proxy state", error);
  });
}

api.storage.onChanged.addListener(handleStorageChanges);
api.proxy.onRequest.addListener(findProxyForRequest, { urls: ["<all_urls>"] });

loadStateFromStorage().catch((error) => {
  console.error("Failed to initialize proxy state", error);
});