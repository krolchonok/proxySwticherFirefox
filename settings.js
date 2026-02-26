const api = typeof browser !== "undefined" ? browser : chrome;

const STORAGE_PROXY_PROFILES = "proxyProfiles";
const STORAGE_HOST_MAPPINGS = "hostMappings";
const STORAGE_DEFAULT_PROFILE_ID = "defaultProfileId";
const STORAGE_WHITELIST_HOSTS = "whitelistHosts";
const STORAGE_GLOBAL_PROXY_ENABLED = "globalProxyEnabled";
const STORAGE_MASTER_PROXY_ENABLED = "masterProxyEnabled";

const proxyProfilesList = document.getElementById("proxyProfilesList");
const noProfilesMessage = proxyProfilesList.querySelector(".no-profiles");
const profileForm = document.querySelector(".profile-form");
const profileFormTitle = document.getElementById("profileFormTitle");
const profileIdInput = document.getElementById("profileId");
const profileNameInput = document.getElementById("profileName");
const profileTypeSelect = document.getElementById("profileType");
const profileHostInput = document.getElementById("profileHost");
const profilePortInput = document.getElementById("profilePort");
const saveProxyProfileBtn = document.getElementById("saveProxyProfile");
const cancelEditProfileBtn = document.getElementById("cancelEditProfile");

const defaultProxyProfileSelect = document.getElementById(
  "defaultProxyProfileSelect"
);
const saveDefaultProfileBtn = document.getElementById("saveDefaultProfile");

const whitelistInput = document.getElementById("whitelistInput");
const saveWhitelistBtn = document.getElementById("saveWhitelist");

const exportAllSettingsBtn = document.getElementById("exportAllSettings");
const importAllSettingsBtn = document.getElementById("importAllSettings");
const importFileInput = document.getElementById("importFile");
const saveToCloudBtn = document.getElementById("saveToCloud");
const loadFromCloudBtn = document.getElementById("loadFromCloud");

function normalizeProxyType(type) {
  const normalized = String(type || "").trim().toLowerCase();
  if (normalized === "https") return "https";
  if (normalized === "socks" || normalized === "socks5") return "socks";
  if (normalized === "socks4") return "socks4";
  return "http";
}

function applyDefaultProfilePolicy(profiles, currentDefaultProfileId) {
  const profileIds = profiles.map((profile) => profile.id);
  const hasCurrentDefault =
    typeof currentDefaultProfileId === "string" &&
    profileIds.includes(currentDefaultProfileId);

  if (profiles.length === 1) {
    return profiles[0].id;
  }

  if (hasCurrentDefault) {
    return currentDefaultProfileId;
  }

  return null;
}

/**
 * Retrieves all settings from api.storage.local.
 * Provides default values if keys are missing or data is invalid.
 * @returns {Promise<object>} A settings object.
 */
async function getAllSettings() {
  try {
    const data = await api.storage.local.get([
      STORAGE_PROXY_PROFILES,
      STORAGE_HOST_MAPPINGS,
      STORAGE_DEFAULT_PROFILE_ID,
      STORAGE_WHITELIST_HOSTS,
      STORAGE_GLOBAL_PROXY_ENABLED,
      STORAGE_MASTER_PROXY_ENABLED,
    ]);

    const settings = {
      [STORAGE_PROXY_PROFILES]: Array.isArray(data[STORAGE_PROXY_PROFILES])
        ? data[STORAGE_PROXY_PROFILES]
        : [],
      [STORAGE_HOST_MAPPINGS]: Array.isArray(data[STORAGE_HOST_MAPPINGS])
        ? data[STORAGE_HOST_MAPPINGS]
        : [],
      [STORAGE_DEFAULT_PROFILE_ID]:
        typeof data[STORAGE_DEFAULT_PROFILE_ID] === "string"
          ? data[STORAGE_DEFAULT_PROFILE_ID]
          : null,
      [STORAGE_WHITELIST_HOSTS]: Array.isArray(data[STORAGE_WHITELIST_HOSTS])
        ? data[STORAGE_WHITELIST_HOSTS]
        : [],
      [STORAGE_GLOBAL_PROXY_ENABLED]:
        data[STORAGE_GLOBAL_PROXY_ENABLED] === true,
      [STORAGE_MASTER_PROXY_ENABLED]:
        data[STORAGE_MASTER_PROXY_ENABLED] !== false,
    };

    return settings;
  } catch (e) {
    console.error(
      "getAllSettings: Error retrieving all settings from api.storage.local:",
      e
    );
    alert("Ошибка при получении настроек из хранилища.");

    return {
      [STORAGE_PROXY_PROFILES]: [],
      [STORAGE_HOST_MAPPINGS]: [],
      [STORAGE_DEFAULT_PROFILE_ID]: null,
      [STORAGE_WHITELIST_HOSTS]: [],
      [STORAGE_GLOBAL_PROXY_ENABLED]: false,
      [STORAGE_MASTER_PROXY_ENABLED]: true,
    };
  }
}

/**
 * Saves the provided settings object to api.storage.local.
 * Performs basic validation and cleaning before saving.
 * @param {object} settings - The settings object to save.
 * @returns {Promise<boolean>} True if successful, false otherwise.
 */
async function saveAllSettings(settings) {
  try {
    const dataToSave = {
      [STORAGE_PROXY_PROFILES]: Array.isArray(settings[STORAGE_PROXY_PROFILES])
        ? settings[STORAGE_PROXY_PROFILES].filter(
            (p) =>
              typeof p.id === "string" &&
              p.id.trim() !== "" &&
              typeof p.name === "string" &&
              p.name.trim() !== "" &&
              typeof p.host === "string" &&
              p.host.trim() !== "" &&
              typeof p.port === "number" &&
              p.port > 0 &&
              p.port <= 65535
          )
        : [],
      [STORAGE_HOST_MAPPINGS]: Array.isArray(settings[STORAGE_HOST_MAPPINGS])
        ? settings[STORAGE_HOST_MAPPINGS].filter(
            (m) =>
              typeof m.host === "string" &&
              m.host.trim() !== "" &&
              (m.profileId === null ||
                m.profileId === undefined ||
                (typeof m.profileId === "string" && m.profileId.trim() !== ""))
          )
        : [],
      [STORAGE_DEFAULT_PROFILE_ID]:
        typeof settings[STORAGE_DEFAULT_PROFILE_ID] === "string" &&
        settings[STORAGE_DEFAULT_PROFILE_ID].trim() !== ""
          ? settings[STORAGE_DEFAULT_PROFILE_ID].trim()
          : null,
      [STORAGE_WHITELIST_HOSTS]: Array.isArray(
        settings[STORAGE_WHITELIST_HOSTS]
      )
        ? settings[STORAGE_WHITELIST_HOSTS].map((item) => item.trim()).filter(
            (item) => item !== ""
          )
        : [],
      [STORAGE_GLOBAL_PROXY_ENABLED]:
        settings[STORAGE_GLOBAL_PROXY_ENABLED] === true,
      [STORAGE_MASTER_PROXY_ENABLED]:
        settings[STORAGE_MASTER_PROXY_ENABLED] !== false,
    };

    dataToSave[STORAGE_PROXY_PROFILES] = dataToSave[STORAGE_PROXY_PROFILES].map(
      (profile) => ({ ...profile, type: normalizeProxyType(profile.type) })
    );
    dataToSave[STORAGE_DEFAULT_PROFILE_ID] = applyDefaultProfilePolicy(
      dataToSave[STORAGE_PROXY_PROFILES],
      dataToSave[STORAGE_DEFAULT_PROFILE_ID]
    );

    await api.storage.local.set(dataToSave);
    return true;
  } catch (e) {
    console.error(
      "saveAllSettings: Ошибка при сохранении всех настроек в api.storage.local:",
      e
    );
    alert("Ошибка при сохранении всех настроек в хранилище.");
    return false;
  }
}

/**
 * Retrieves settings from api.storage.sync (облако).
 * @returns {Promise<object>} A settings object.
 */
async function getAllSettingsFromCloud() {
  try {
    const data = await api.storage.sync.get([
      STORAGE_PROXY_PROFILES,
      STORAGE_HOST_MAPPINGS,
      STORAGE_DEFAULT_PROFILE_ID,
      STORAGE_WHITELIST_HOSTS,
      STORAGE_GLOBAL_PROXY_ENABLED,
      STORAGE_MASTER_PROXY_ENABLED,
    ]);

    const settings = {
      [STORAGE_PROXY_PROFILES]: Array.isArray(data[STORAGE_PROXY_PROFILES])
        ? data[STORAGE_PROXY_PROFILES]
        : [],
      [STORAGE_HOST_MAPPINGS]: Array.isArray(data[STORAGE_HOST_MAPPINGS])
        ? data[STORAGE_HOST_MAPPINGS]
        : [],
      [STORAGE_DEFAULT_PROFILE_ID]:
        typeof data[STORAGE_DEFAULT_PROFILE_ID] === "string"
          ? data[STORAGE_DEFAULT_PROFILE_ID]
          : null,
      [STORAGE_WHITELIST_HOSTS]: Array.isArray(data[STORAGE_WHITELIST_HOSTS])
        ? data[STORAGE_WHITELIST_HOSTS]
        : [],
      [STORAGE_GLOBAL_PROXY_ENABLED]:
        data[STORAGE_GLOBAL_PROXY_ENABLED] === true,
      [STORAGE_MASTER_PROXY_ENABLED]:
        data[STORAGE_MASTER_PROXY_ENABLED] !== false,
    };

    return settings;
  } catch (e) {
    console.error(
      "getAllSettingsFromCloud: Error retrieving settings from api.storage.sync:",
      e
    );
    alert("Ошибка при получении настроек из облака.");

    return {
      [STORAGE_PROXY_PROFILES]: [],
      [STORAGE_HOST_MAPPINGS]: [],
      [STORAGE_DEFAULT_PROFILE_ID]: null,
      [STORAGE_WHITELIST_HOSTS]: [],
      [STORAGE_GLOBAL_PROXY_ENABLED]: false,
      [STORAGE_MASTER_PROXY_ENABLED]: true,
    };
  }
}

/**
 * Saves the provided settings object to api.storage.sync (облако).
 * Performs basic validation and cleaning before saving.
 * @param {object} settings - The settings object to save.
 * @returns {Promise<boolean>} True if successful, false otherwise.
 */
async function saveAllSettingsToCloud(settings) {
  try {
    const dataToSave = {
      [STORAGE_PROXY_PROFILES]: Array.isArray(settings[STORAGE_PROXY_PROFILES])
        ? settings[STORAGE_PROXY_PROFILES].filter(
            (p) =>
              typeof p.id === "string" &&
              p.id.trim() !== "" &&
              typeof p.name === "string" &&
              p.name.trim() !== "" &&
              typeof p.host === "string" &&
              p.host.trim() !== "" &&
              typeof p.port === "number" &&
              p.port > 0 &&
              p.port <= 65535
          )
        : [],
      [STORAGE_HOST_MAPPINGS]: Array.isArray(settings[STORAGE_HOST_MAPPINGS])
        ? settings[STORAGE_HOST_MAPPINGS].filter(
            (m) =>
              typeof m.host === "string" &&
              m.host.trim() !== "" &&
              (m.profileId === null ||
                m.profileId === undefined ||
                (typeof m.profileId === "string" && m.profileId.trim() !== ""))
          )
        : [],
      [STORAGE_DEFAULT_PROFILE_ID]:
        typeof settings[STORAGE_DEFAULT_PROFILE_ID] === "string" &&
        settings[STORAGE_DEFAULT_PROFILE_ID].trim() !== ""
          ? settings[STORAGE_DEFAULT_PROFILE_ID].trim()
          : null,
      [STORAGE_WHITELIST_HOSTS]: Array.isArray(
        settings[STORAGE_WHITELIST_HOSTS]
      )
        ? settings[STORAGE_WHITELIST_HOSTS].map((item) => item.trim()).filter(
            (item) => item !== ""
          )
        : [],
      [STORAGE_GLOBAL_PROXY_ENABLED]:
        settings[STORAGE_GLOBAL_PROXY_ENABLED] === true,
      [STORAGE_MASTER_PROXY_ENABLED]:
        settings[STORAGE_MASTER_PROXY_ENABLED] !== false,
    };

    dataToSave[STORAGE_PROXY_PROFILES] = dataToSave[STORAGE_PROXY_PROFILES].map(
      (profile) => ({ ...profile, type: normalizeProxyType(profile.type) })
    );
    dataToSave[STORAGE_DEFAULT_PROFILE_ID] = applyDefaultProfilePolicy(
      dataToSave[STORAGE_PROXY_PROFILES],
      dataToSave[STORAGE_DEFAULT_PROFILE_ID]
    );

    await api.storage.sync.set(dataToSave);
    return true;
  } catch (e) {
    console.error(
      "saveAllSettingsToCloud: Ошибка при сохранении всех настроек в api.storage.sync:",
      e
    );
    alert("Ошибка при сохранении настроек в облако.");
    return false;
  }
}

/**
 * Loads settings from storage and populates the UI.
 */
async function loadSettings() {
  try {
    const settings = await getAllSettings();
    const normalizedDefault = applyDefaultProfilePolicy(
      settings[STORAGE_PROXY_PROFILES],
      settings[STORAGE_DEFAULT_PROFILE_ID]
    );

    if (normalizedDefault !== settings[STORAGE_DEFAULT_PROFILE_ID]) {
      settings[STORAGE_DEFAULT_PROFILE_ID] = normalizedDefault;
      await saveAllSettings(settings);
      return;
    }

    displayProfiles(settings[STORAGE_PROXY_PROFILES]);

    populateDefaultProfileSelect(
      settings[STORAGE_PROXY_PROFILES],
      settings[STORAGE_DEFAULT_PROFILE_ID]
    );

    whitelistInput.value = Array.isArray(settings[STORAGE_WHITELIST_HOSTS])
      ? settings[STORAGE_WHITELIST_HOSTS].join("\n")
      : "";

    resetProfileForm();
  } catch (e) {
    console.error("loadSettings: Ошибка при загрузке настроек в UI:", e);
    alert("Ошибка при загрузке настроек в интерфейс.");
  }
}

/**
 * Displays the list of proxy profiles in the UI.
 * @param {Array<object>} profiles - Array of profile objects.
 */
function displayProfiles(profiles) {
  proxyProfilesList.innerHTML = "";

  if (!profiles || profiles.length === 0) {
    const div = document.createElement("div");
    div.className = "no-profiles";
    div.textContent = "Нет сохраненных профилей";
    proxyProfilesList.appendChild(div);
    return;
  }

  profiles.forEach((profile) => {
    const div = document.createElement("div");
    div.className = "profile-item";

    const profileDetails = document.createElement("span");
    profileDetails.textContent = `${escapeHTML(
      profile.name
    )} [${profile.type.toUpperCase()}] ${escapeHTML(profile.host)}:${
      profile.port
    }`;
    div.appendChild(profileDetails);

    const buttonContainer = document.createElement("div");
    buttonContainer.className = "profile-item-buttons";

    const editBtn = document.createElement("button");
    editBtn.textContent = "Редактировать";
    editBtn.className = "btn btn-info btn-sm";
    editBtn.addEventListener("click", () => editProfile(profile.id));
    buttonContainer.appendChild(editBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Удалить";
    deleteBtn.className = "btn btn-danger btn-sm";
    deleteBtn.addEventListener("click", () => deleteProfile(profile.id));
    buttonContainer.appendChild(deleteBtn);

    div.appendChild(buttonContainer);
    proxyProfilesList.appendChild(div);
  });
}

/**
 * Populates the default profile select dropdown.
 * @param {Array<object>} profiles - Array of profile objects.
 * @param {string|null} currentDefaultProfileId - The ID of the currently selected default profile.
 */
function populateDefaultProfileSelect(profiles, currentDefaultProfileId) {
  defaultProxyProfileSelect.innerHTML =
    '<option value="">Выберите профиль (Не выбрано)</option>';

  profiles.forEach((profile) => {
    const option = document.createElement("option");
    option.value = profile.id;
    option.textContent = profile.name;
    if (profile.id === currentDefaultProfileId) {
      option.selected = true;
    }
    defaultProxyProfileSelect.appendChild(option);
  });
}

/**
 * Resets the profile form to the 'Add New Profile' state.
 */
function resetProfileForm() {
  profileFormTitle.textContent = "Добавить новый профиль";
  profileIdInput.value = "";
  profileNameInput.value = "";
  profileTypeSelect.value = "http";
  profileHostInput.value = "";
  profilePortInput.value = "";
  saveProxyProfileBtn.textContent = "Сохранить профиль";
  cancelEditProfileBtn.style.display = "none";
}

/**
 * Populates the profile form with data from a profile for editing.
 * @param {string} profileId - The ID of the profile to edit.
 */
async function editProfile(profileId) {
  const settings = await getAllSettings();
  const profile = settings[STORAGE_PROXY_PROFILES].find(
    (p) => p.id === profileId
  );

  if (!profile) {
    console.error("editProfile: Profile not found:", profileId);
    alert("Ошибка: Профиль для редактирования не найден.");
    return;
  }

  profileFormTitle.textContent = `Редактировать профиль: ${escapeHTML(
    profile.name
  )}`;
  profileIdInput.value = profile.id;
  profileNameInput.value = profile.name;
  profileTypeSelect.value = normalizeProxyType(profile.type);
  profileHostInput.value = profile.host;
  profilePortInput.value = profile.port;
  saveProxyProfileBtn.textContent = "Сохранить изменения";
  cancelEditProfileBtn.style.display = "inline-block";
}

/**
 * Handles saving a profile (either adding new or updating existing).
 */
async function handleSaveProfile() {
  const id = profileIdInput.value.trim();
  const name = profileNameInput.value.trim();
  const type = normalizeProxyType(profileTypeSelect.value);
  const host = profileHostInput.value.trim();
  const port = parseInt(profilePortInput.value.trim(), 10);

  if (!name || !host || !port || isNaN(port) || port <= 0 || port > 65535) {
    alert("Пожалуйста, заполните все поля профиля корректно.");
    return;
  }

  const currentSettings = await getAllSettings();
  let profiles = currentSettings[STORAGE_PROXY_PROFILES];

  if (id) {
    const index = profiles.findIndex((p) => p.id === id);
    if (index !== -1) {
      if (profiles.some((p) => p.name === name && p.id !== id)) {
        alert(
          `Профиль с названием "${name}" уже существует. Пожалуйста, используйте другое название.`
        );
        return;
      }
      profiles[index] = { id, name, type, host, port };
    } else {
      console.error(
        "handleSaveProfile: Attempted to edit non-existent profile ID:",
        id
      );
      alert("Ошибка при сохранении: Редактируемый профиль не найден.");
      return;
    }
  } else {
    if (profiles.some((p) => p.name === name)) {
      alert(
        `Профиль с названием "${name}" уже существует. Пожалуйста, используйте другое название.`
      );
      return;
    }

    const newId = `profile-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 15)}`;
    profiles.push({ id: newId, name, type, host, port });
  }

  currentSettings[STORAGE_PROXY_PROFILES] = profiles;

  if (await saveAllSettings(currentSettings)) {
    alert("Профиль успешно сохранен!");
    loadSettings();
  } else {
    alert("Не удалось сохранить профиль.");
  }
}

/**
 * Deletes a profile by its ID.
 * @param {string} profileId - The ID of the profile to delete.
 */
async function deleteProfile(profileId) {
  if (
    !confirm(
      "Вы уверены, что хотите удалить этот профиль? Хосты, использующие этот профиль, перейдут на использование профиля по умолчанию (если задан) или прямое соединение."
    )
  ) {
    return;
  }

  const currentSettings = await getAllSettings();
  let profiles = currentSettings[STORAGE_PROXY_PROFILES];
  let hostMappings = currentSettings[STORAGE_HOST_MAPPINGS];
  let defaultProfileId = currentSettings[STORAGE_DEFAULT_PROFILE_ID];

  const initialProfileCount = profiles.length;
  profiles = profiles.filter((p) => p.id !== profileId);

  if (profiles.length === initialProfileCount) {
    console.warn(
      "deleteProfile: Attempted to delete non-existent profile ID:",
      profileId
    );
    alert("Ошибка: Профиль для удаления не найден.");
    return;
  }

  hostMappings = hostMappings.filter((m) => m.profileId !== profileId);

  if (defaultProfileId === profileId) {
    defaultProfileId = null;
  }

  currentSettings[STORAGE_PROXY_PROFILES] = profiles;
  currentSettings[STORAGE_HOST_MAPPINGS] = hostMappings;
  currentSettings[STORAGE_DEFAULT_PROFILE_ID] = defaultProfileId;

  if (await saveAllSettings(currentSettings)) {
    alert("Профиль успешно удален!");
    loadSettings();
  } else {
    alert("Не удалось удалить профиль.");
  }
}

/**
 * Handles saving the selected default profile.
 */
async function handleSaveDefaultProfile() {
  const selectedProfileId = defaultProxyProfileSelect.value || null;

  const currentSettings = await getAllSettings();

  if (selectedProfileId !== null) {
    const profileExists = currentSettings[STORAGE_PROXY_PROFILES].some(
      (p) => p.id === selectedProfileId
    );
    if (!profileExists) {
      console.warn(
        "handleSaveDefaultProfile: Selected profile ID does not exist in current profiles."
      );
      alert(
        "Ошибка: Выбранный профиль по умолчанию не найден. Пожалуйста, выберите другой или создайте его."
      );

      populateDefaultProfileSelect(
        currentSettings[STORAGE_PROXY_PROFILES],
        currentSettings[STORAGE_DEFAULT_PROFILE_ID]
      );
      return;
    }
  }

  currentSettings[STORAGE_DEFAULT_PROFILE_ID] = selectedProfileId;

  if (await saveAllSettings(currentSettings)) {
    alert("Настройки профиля по умолчанию успешно сохранены!");
  } else {
    alert("Не удалось сохранить настройки профиля по умолчанию.");
  }
}

/**
 * Handles saving the whitelist.
 */
async function handleSaveWhitelist() {
  const whitelistText = whitelistInput.value.trim();

  const whitelistArray = whitelistText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

  try {
    const currentSettings = await getAllSettings();
    currentSettings[STORAGE_WHITELIST_HOSTS] = whitelistArray;

    if (await saveAllSettings(currentSettings)) {
      alert("Белый список успешно сохранен!");
    } else {
      alert("Не удалось сохранить белый список.");
    }
  } catch (e) {
    console.error(
      "handleSaveWhitelist: Ошибка при сохранении белого списка:",
      e
    );
    alert("Ошибка при сохранении белого списка.");
  }
}

exportAllSettingsBtn.addEventListener("click", async () => {
  const settings = await getAllSettings();

  if (
    settings[STORAGE_PROXY_PROFILES].length === 0 &&
    settings[STORAGE_HOST_MAPPINGS].length === 0 &&
    settings[STORAGE_DEFAULT_PROFILE_ID] === null &&
    settings[STORAGE_WHITELIST_HOSTS].length === 0 &&
    !settings[STORAGE_GLOBAL_PROXY_ENABLED] &&
    settings[STORAGE_MASTER_PROXY_ENABLED]
  ) {
    const storageCheck = await api.storage.local.get(
      STORAGE_MASTER_PROXY_ENABLED
    );
    const isMasterExplicitlyDisabled =
      storageCheck[STORAGE_MASTER_PROXY_ENABLED] === false;

    if (!isMasterExplicitlyDisabled) {
      alert("Нет настроек для экспорта.");
      return;
    }
  }

  const json = JSON.stringify(settings, null, 2);
  const blob = new Blob([json], { type: "application/json" });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;

  const now = new Date();
  const timestamp = `${String(now.getDate()).padStart(2, "0")}_${String(
    now.getMonth() + 1
  ).padStart(2, "0")}_${now.getFullYear()}_${String(now.getHours()).padStart(
    2,
    "0"
  )}_${String(now.getMinutes()).padStart(2, "0")}_${String(
    now.getSeconds()
  ).padStart(2, "0")}`;

  link.download = `proxy_settings_${timestamp}.json`;
  document.body.appendChild(link);
  link.click();

  document.body.removeChild(link);
  URL.revokeObjectURL(url);
});

importAllSettingsBtn.addEventListener("click", () => {
  importFileInput.click();
});

importFileInput.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();

  reader.onload = async function (e) {
    try {
      const jsonContent = e.target.result;
      const importedSettings = JSON.parse(jsonContent);

      if (typeof importedSettings === "object" && importedSettings !== null) {
        const expectedKeys = [
          STORAGE_PROXY_PROFILES,
          STORAGE_HOST_MAPPINGS,
          STORAGE_DEFAULT_PROFILE_ID,
          STORAGE_WHITELIST_HOSTS,
          STORAGE_GLOBAL_PROXY_ENABLED,
          STORAGE_MASTER_PROXY_ENABLED,
        ];
        const hasExpectedKeys = expectedKeys.some((key) =>
          importedSettings.hasOwnProperty(key)
        );

        if (!hasExpectedKeys) {
          console.warn(
            "importFileInput: Imported file does not contain expected settings structure."
          );
          alert(
            "Ошибка импорта: Файл не содержит корректной структуры настроек."
          );
          return;
        }

        const importedProfiles = Array.isArray(
          importedSettings[STORAGE_PROXY_PROFILES]
        )
          ? importedSettings[STORAGE_PROXY_PROFILES]
          : [];
        const importedMappings = Array.isArray(
          importedSettings[STORAGE_HOST_MAPPINGS]
        )
          ? importedSettings[STORAGE_HOST_MAPPINGS]
          : [];
        const profileIdMap = new Map();

        const newProfiles = importedProfiles.map((profile) => {
          const oldId = profile.id;

          const newId = `profile-${Date.now()}-${Math.random()
            .toString(36)
            .substring(2, 15)}`;
          profileIdMap.set(oldId, newId);
          return { ...profile, id: newId };
        });

        const newMappings = importedMappings
          .map((mapping) => {
            if (!mapping || typeof mapping.host !== "string") {
              return null;
            }

            if (!mapping.profileId) {
              return { host: mapping.host, profileId: null };
            }

            const newProfileId = profileIdMap.get(mapping.profileId);

            if (newProfileId) {
              return { host: mapping.host, profileId: newProfileId };
            } else {
              console.warn(
                `Import: Host mapping for "${mapping.host}" referenced a profile ID (${mapping.profileId}) not found in the imported profiles. Mapping skipped.`
              );
              return null;
            }
          })
          .filter((mapping) => mapping !== null);

        const newDefaultProfileId = importedSettings[STORAGE_DEFAULT_PROFILE_ID]
          ? profileIdMap.get(importedSettings[STORAGE_DEFAULT_PROFILE_ID]) ||
            null
          : null;

        const settingsToSave = {
          ...importedSettings,
          [STORAGE_PROXY_PROFILES]: newProfiles,
          [STORAGE_HOST_MAPPINGS]: newMappings,
          [STORAGE_DEFAULT_PROFILE_ID]: newDefaultProfileId,
        };

        if (await saveAllSettings(settingsToSave)) {
          alert("Настройки успешно загружены из файла!");
          loadSettings();
        } else {
          alert("Не удалось сохранить настройки из файла.");
        }
      } else {
        console.warn(
          "importFileInput: Import failed: File does not contain a valid settings object."
        );
        alert(
          "Ошибка импорта: Файл должен содержать настройки в формате JSON объекта."
        );
      }
    } catch (err) {
      console.error("importFileInput: Ошибка при импорте файла:", err);
      alert("Ошибка при загрузке файла или некорректный формат JSON.");
    } finally {
      importFileInput.value = "";
    }
  };

  reader.onerror = function (e) {
    console.error("importFileInput: Error reading file:", reader.error);
    alert("Ошибка при чтении файла.");
  };

  reader.readAsText(file);
});

saveToCloudBtn.addEventListener("click", async () => {
  try {
    const settings = await getAllSettings();
    if (await saveAllSettingsToCloud(settings)) {
      alert("Настройки сохранены в облако!");
    } else {
      alert("Не удалось сохранить настройки в облако.");
    }
  } catch (e) {
    console.error(
      "saveToCloudBtn: Ошибка при сохранении настроек в облако:",
      e
    );
    alert("Ошибка при сохранении настроек в облако.");
  }
});

loadFromCloudBtn.addEventListener("click", async () => {
  try {
    const cloudSettings = await getAllSettingsFromCloud();
    if (await saveAllSettings(cloudSettings)) {
      alert("Настройки загружены из облака!");
      loadSettings();
    } else {
      alert("Не удалось сохранить настройки из облака.");
    }
  } catch (e) {
    console.error(
      "loadFromCloudBtn: Ошибка при загрузке настроек из облака:",
      e
    );
    alert("Ошибка при загрузке настроек из облака.");
  }
});

saveProxyProfileBtn.addEventListener("click", handleSaveProfile);
cancelEditProfileBtn.addEventListener("click", resetProfileForm);
saveDefaultProfileBtn.addEventListener("click", handleSaveDefaultProfile);
saveWhitelistBtn.addEventListener("click", handleSaveWhitelist);

/**
 * Escapes HTML characters in a string to prevent XSS when displaying in UI.
 * @param {string} str - The string to escape.
 * @returns {string} The escaped string.
 */
function escapeHTML(str) {
  if (typeof str !== "string") return str;
  return str.replace(
    /[&<>"']/g,
    (tag) =>
      ({
        "&": "&",
        "<": "<",
        ">": ">",
        '"': '"',
        "'": "'",
      }[tag])
  );
}

document.addEventListener("DOMContentLoaded", loadSettings);

api.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local") {
    const relevantKeys = [
      STORAGE_PROXY_PROFILES,
      STORAGE_DEFAULT_PROFILE_ID,
      STORAGE_WHITELIST_HOSTS,
    ];
    const changedRelevantKey = relevantKeys.some((key) =>
      changes.hasOwnProperty(key)
    );

    if (changedRelevantKey) {
      loadSettings();
    }
  }
});
