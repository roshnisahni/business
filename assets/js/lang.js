const GITHUB_CONFIG = {
    token: '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',
    repo: 'roshnisahni/business', 
    folder: 'locales'
};

const langMap = { 
    'in': 'hi', // India -> Hindi
    'de': 'de', // Germany -> German
    'at': 'de', // Austria -> German
    'ch': 'de', // Switzerland -> German
    'fr': 'fr', // France -> French
    'be': 'fr', // Belgium -> French
    'es': 'es', // Spain -> Spanish
    'mx': 'es', // Mexico -> Spanish
    'ar': 'es', // Argentina -> Spanish
    'it': 'it', // Italy -> Italian
    'ae': 'ar', // UAE -> Arabic
    'sa': 'ar', // Saudi Arabia -> Arabic
    'eg': 'ar', // Egypt -> Arabic
    'br': 'pt', // Brazil -> Portuguese
    'pt': 'pt', // Portugal -> Portuguese
    'nl': 'nl', // Netherlands -> Dutch
    'pl': 'pl', // Poland -> Polish
    'tr': 'tr', // Turkey -> Turkish
    'jp': 'ja', // Japan -> Japanese
    'kr': 'ko', // South Korea -> Korean
    'ru': 'ru', // Russia -> Russian
    'vn': 'vi', // Vietnam -> Vietnamese
    'us': 'en', // USA -> English
    'gb': 'en', // UK -> English
    'au': 'en'  // Australia -> English
};

function toBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
}

async function updateGitHubFile(lang, newCache) {
    try {
        const url = `https://api.github.com/repos/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.folder}/${lang}.json`;
        const getRes = await fetch(url, { 
          headers: { 
                'Authorization': `Bearer ${GITHUB_CONFIG.token}`,
                'Accept': 'application/vnd.github.v3+json', 
                'User-Agent': 'TranslationApp'     
         }
        });

        const fileData = await getRes.json();
 
        const putRes = await fetch(url, { 
            method: 'PUT',
            headers: { 
               'Authorization': `Bearer ${GITHUB_CONFIG.token}`,
                'Accept': 'application/vnd.github.v3+json', 
                'User-Agent': 'TranslationApp'     
            }, 
            body: JSON.stringify({
                message: `Auto-update ${lang} cache`,
                content: toBase64(JSON.stringify(newCache, null, 2)),
                sha: fileData.sha
            })
        });
        const result = await putRes.json();

        // If you want to see the readable text:
        const decodedContent = atob(result.content.replace(/\n/g, ''));
        console.log("Readable Content:", JSON.parse(decodedContent));

        
        if (!putRes.ok) {
            console.error("🚨 GitHub Update Failed!");
            console.error("Status:", putRes.status);
            console.error("Error Message:", result.message);
            console.error("Details:", result.errors); // This often contains the real reason
        } else {
            console.log("✅ Success!", result);
        }

        console.log("GitHub API Status:", putRes.status);
    } catch (err) {
        console.error("Failed to save updated file to GitHub:", err);
    }
}

async function translateFullPage(targetLang) {
    if (targetLang === 'en') return;

    const elements = document.querySelectorAll('[data-unique]:not([data-no-translate]), [class*="data-"]');

    let localData = {};
    let newTranslationsCount = 0;

    try {        
        const url = `https://api.github.com/repos/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.folder}/${targetLang}.json?t=${new Date().getTime()}`;
        const res = await fetch(url, {
            headers: { 'Authorization': `token ${GITHUB_CONFIG.token}` }
        });

        if (res.ok) {
            const fileData = await res.json();
            if (fileData.content) {
                const decodedContent = decodeURIComponent(escape(atob(fileData.content.replace(/\s/g, ''))));
                localData = JSON.parse(decodedContent);
                console.log("🔥 Live Real-time Cache loaded! Total items:", Object.keys(localData).length);
            }
        } else {
            console.warn("GitHub cache file not found.");
            return; 
        }
    } catch (e) { 
        console.error("Failed to load real-time cache due to broken JSON:", e);
        return; 
    }

    console.log("--- STARTING HYBRID TRANSLATION LOOP ---");
    console.log("Total Translation Elements Found on Page:", elements.length);

    for (let el of elements) {
        let uniqueKey = el.getAttribute('data-unique')?.trim();

        if (!uniqueKey) {
            const langClass = Array.from(el.classList).find(cls => cls.startsWith('data-'));
            if (langClass) {
                uniqueKey = langClass.replace('data-', '');
            }
        }

        let text = el.innerText.trim();
        if (!uniqueKey || !text || el.hasAttribute('data-translated')) continue;

        if (localData[uniqueKey]) {
            console.log(`🎉 MATCH SUCCESS! Key: "${uniqueKey}" -> Changed to: ${localData[uniqueKey]}`);
            el.innerText = localData[uniqueKey];
            el.setAttribute('data-translated', 'true');
        }
        else {
            console.log(`⚠️ NOT FOUND! Key "${uniqueKey}" missing. Requesting API...`);
            try {
                await new Promise(resolve => setTimeout(resolve, 200));

                const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${targetLang}&de=${encodeURIComponent('roshnisahni798@gmail.com')}`;
                const res = await fetch(url);
                const data = await res.json();

                if (data.responseData.translatedText?.includes("YOU USED ALL AVAILABLE") || data.responseStatus === 429) {
                    console.warn("Daily translation limit reached for MyMemory API.");
                    break; 
                }

                if (data.responseData?.translatedText) {
                    const translated = data.responseData.translatedText;
                    el.innerText = translated;
                    el.setAttribute('data-translated', 'true');

                    localData[uniqueKey] = translated;
                    newTranslationsCount++;
                    if (newTranslationsCount >= 5) {
                        console.log("Saving batch to GitHub...");
                        await updateGitHubFile(targetLang, localData);
                        newTranslationsCount = 0;
                    }
                }
            } catch (err) {
                console.error("API Error for key:", uniqueKey, err);
            }
        }
    }
    if (newTranslationsCount > 0) {
        console.log("Saving final batch to GitHub...");
        await updateGitHubFile(targetLang, localData);
    }

    console.log("--- END OF HYBRID TRANSLATION LOOP ---");
}

// --- LANGUAGE SELECTION AND DROPDOWN CONFIG ---

function changeLanguage(targetLang) {
    localStorage.setItem('user-lang', targetLang);
    window.location.reload();
}

function updateDropdownUI(lang) {
    const dropdown = document.getElementById('langSelect');
    if (dropdown) dropdown.value = lang;
}

function initLanguage() {
    const savedLang = localStorage.getItem('user-lang');
    if (savedLang) {
        updateDropdownUI(savedLang);
        translateFullPage(savedLang);
        return;
    }

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}`)
                .then(r => r.json())
                .then(data => {
                    const countryCode = data.address.country_code.toLowerCase();
                    const lang = langMap[countryCode] || 'en';

                    localStorage.setItem('user-lang', lang);
                    updateDropdownUI(lang);
                    translateFullPage(lang);
                });
        }, (err) => {
            localStorage.setItem('user-lang', 'en');
            updateDropdownUI('en');
        });
    } else {
        localStorage.setItem('user-lang', 'en');
        updateDropdownUI('en');
    }
}
window.addEventListener('load', initLanguage);
