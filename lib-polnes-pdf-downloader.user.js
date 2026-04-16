// ==UserScript==
// @name         POLNES Library PDF Downloader
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Polnes Library PDF Blobs Downloader
// @author       ahmadardani
// @homepageURL  https://github.com/ahmadardani/lib-polnes-pdf-downloader
// @supportURL   https://github.com/ahmadardani/lib-polnes-pdf-downloader/issues
// @match        https://lib.polnes.ac.id/*
// @grant        none
// ==/UserScript==

(function () {
    "use strict";

    let suggestedTitle = null;

    // --- Find document title from page elements ---
    function getPageTitle() {
        const selectors = ["h1", "h2", "h3", ".text-xl", ".font-bold", "strong"];
        for (let s of selectors) {
            let el = document.querySelector(s);
            if (el && el.innerText.trim().length > 10) {
                let text = el.innerText.trim().toLowerCase();
                // Filter out generic boilerplate
                if (!text.includes("repository") && !text.includes("polnes")) {
                    return el.innerText.trim();
                }
            }
        }
        return "document";
    }

    // --- Clean filename for OS compatibility ---
    function sanitize(name) {
        return name.replace(/[\/\\?%*:|"<>]/g, "-").trim();
    }

    // --- Save Logic ---
    function triggerDownload(blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");

        const defaultName = sanitize(suggestedTitle || getPageTitle());
        const fileName = prompt("Save PDF as:", defaultName);

        if (fileName === null) {
            URL.revokeObjectURL(url);
            return;
        }

        a.href = url;
        a.download = (sanitize(fileName) || "document") + ".pdf";
        a.click();
        URL.revokeObjectURL(url);
    }

    // --- UI Button ---
    function injectButton(blob) {
        if (document.getElementById("pdf-dl-btn")) return;

        const btn = document.createElement("button");
        btn.id = "pdf-dl-btn";
        btn.innerText = "Download PDF";
        btn.style = `
            position: fixed; bottom: 20px; right: 20px;
            padding: 12px 16px; background: #22c55e; color: white;
            font-size: 14px; font-weight: bold; z-index: 999999;
            border: none; border-radius: 8px; cursor: pointer;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1); transition: 0.2s;
        `;

        btn.onmouseover = () => {
            btn.style.background = "#16a34a";
            btn.style.transform = "scale(1.05)";
        };
        btn.onmouseout = () => {
            btn.style.background = "#22c55e";
            btn.style.transform = "scale(1)";
        };

        btn.onclick = () => triggerDownload(blob);
        document.body.appendChild(btn);
    }

    // --- Fetch Interceptor ---
    const rawFetch = window.fetch;
    window.fetch = function () {
        return rawFetch.apply(this, arguments).then(async (res) => {
            try {
                const clone = res.clone();
                const buf = await clone.arrayBuffer();
                const bytes = new Uint8Array(buf);

                // Check for %PDF signature
                if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
                    injectButton(new Blob([buf], { type: "application/pdf" }));
                }
            } catch (e) {}
            return res;
        });
    };

    // --- XHR Interceptor ---
    const rawSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function () {
        this.addEventListener("load", function () {
            try {
                const buf = this.response;
                if (!(buf instanceof ArrayBuffer)) return;
                const bytes = new Uint8Array(buf);

                if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
                    injectButton(new Blob([buf], { type: "application/pdf" }));
                }
            } catch (e) {}
        });
        this.responseType = "arraybuffer";
        rawSend.apply(this, arguments);
    };

    // --- Observer to grab title when page loads ---
    const obs = new MutationObserver(() => {
        const t = getPageTitle();
        if (t !== "document") {
            suggestedTitle = t;
            obs.disconnect();
        }
    });
    obs.observe(document.body, { childList: true, subtree: true });

})();
