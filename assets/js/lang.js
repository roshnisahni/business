const GITHUB_CONFIG = {
    const token = localStorage.getItem('gh_token');
    token: token,
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
// Required for non-English characters (Hindi, etc.)
function toBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
}

async function updateGitHubFile(lang, newCache) {
    try {
        const filePath = `${lang}.json`; 
        const url = `https://api.github.com/repos/${GITHUB_CONFIG.repo}/contents/${filePath}`;

        // पहले गिटहब से मौजूदा फ़ाइल का SHA टोकन लें
        const getRes = await fetch(url, { headers: { 'Authorization': `token ${GITHUB_CONFIG.token}` }});
        const fileData = await getRes.json();

        // अब फ़ाइल को नए कैश डेटा के साथ गिटहब पर राइट (PUT) करें
        const putRes = await fetch(url, { 
            method: 'PUT',
            headers: { 
                'Authorization': `token ${GITHUB_CONFIG.token}`,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({
                message: `Auto-update ${lang} cache`,
                content: toBase64(JSON.stringify(newCache, null, 2)),
                sha: fileData.sha
            })
        });

        console.log("GitHub API Status:", putRes.status);
    } catch (err) {
        console.error("Failed to save updated file to GitHub:", err);
    }
}

async function translateFullPage(targetLang) {
    if (targetLang === 'en') return;

    // हाइब्रिड सेलेक्टर: यह आपके नए data-unique को भी ढूंढेगा और पुरानी data- क्लासेस को भी!
    const elements = document.querySelectorAll('[data-unique]:not([data-no-translate]), [class*="data-"]');

    let localData = {};
    let newTranslationsCount = 0;

    // गिटहब से लाइव डेटा फ़ेच करने का 100% सही तरीका
    try {
        const url = `https://api.github.com/repos/${GITHUB_CONFIG.repo}/contents/${targetLang}.json?t=${new Date().getTime()}`;
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
            return; // अगर फाइल नहीं मिली तो यहीं रुक जाओ, आगे लूप मत चलाओ!
        }
    } catch (e) { 
        console.error("Failed to load real-time cache due to broken JSON:", e);
        return; // CRITICAL FIX: अगर JSON टूटा हुआ है, तो आगे मत बढ़ो! API ब्लास्ट होने से बचाओ।
    }

    console.log("--- STARTING HYBRID TRANSLATION LOOP ---");
    console.log("Total Translation Elements Found on Page:", elements.length);

    // सभी एलिमेंट्स पर लूप चलाएं
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

        // फ्लो ए: अगर की (Key) गिटहब फ़ाइल में मिल गई
        if (localData[uniqueKey]) {
            console.log(`🎉 MATCH SUCCESS! Key: "${uniqueKey}" -> Changed to: ${localData[uniqueKey]}`);
            el.innerText = localData[uniqueKey];
            el.setAttribute('data-translated', 'true');
        }
        // फ्लो बी: अगर वर्ड फ़ाइल में नहीं मिला, तो MyMemory API से ट्रांसलेट करके गिटहब पर सेव करें
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

                    // हर 20 नए वर्ड्स के बाद गिटहब फ़ाइल को ऑटो-अपडेट करें
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

    // लूप खत्म होने के बाद बचे हुए नए वर्ड्स को फाइनल सेव करें
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

// आपके पुराने मक्खन जैसे वर्किंग फ्लो की तरह 'load' पर ही चलाएंगे
window.addEventListener('load', initLanguage);
