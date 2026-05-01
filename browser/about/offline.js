(function () {
      var TARGET = "https://browser.tahai.net/";
      var TIMEOUT_MS = 2500;
      var status = document.getElementById("status");
      var stayLocal = document.getElementById("stayLocal");
      var cancelled = false;

      function setStatus(message) {
        if (status) status.textContent = message;
      }

      if (stayLocal) {
        stayLocal.addEventListener("click", function () {
          cancelled = true;
          setStatus("Local fallback selected. You can open browser.tahai.net later when connected.");
        });
      }

      function goOnline() {
        if (cancelled) return;
        setStatus("Connection available. Opening " + TARGET);
        window.location.replace(TARGET);
      }

      function stayOffline(reason) {
        if (cancelled) return;
        setStatus(
          "Online About page could not be reached. Local fallback is active." +
            (reason ? " Details: " + reason : "")
        );
      }

      if (navigator && navigator.onLine === false) {
        stayOffline("This device reports offline status.");
        return;
      }

      var timeout = window.setTimeout(function () {
        stayOffline("Connection check timed out.");
      }, TIMEOUT_MS);

      fetch(TARGET, {
        method: "GET",
        mode: "no-cors",
        cache: "no-store"
      })
        .then(function () {
          window.clearTimeout(timeout);
          goOnline();
        })
        .catch(function (error) {
          window.clearTimeout(timeout);
          stayOffline(error && error.message ? error.message : "Network request failed.");
        });
    })();
