(function () {
  var patches = [];
  var unregisterCommand = null;

  function getStorage() {
    try {
      if (typeof vendetta !== "undefined" && vendetta.plugin && vendetta.plugin.storage) {
        return vendetta.plugin.storage;
      }
    } catch (e) {}
    return { customDate: "2016-01-01", enabled: true };
  }

  function parseDateToTimestamp(dateStr) {
    if (!dateStr || typeof dateStr !== "string") return null;
    var trimmed = dateStr.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
    var parsed = Date.parse(trimmed + "T00:00:00.000Z");
    return isNaN(parsed) ? null : parsed;
  }

  var plugin = {
    onLoad: function () {
      var metro = vendetta.metro;
      var findByProps = metro.findByProps;
      var findByStoreName = metro.findByStoreName;
      var after = vendetta.patcher.after;
      var storage = getStorage();
      var registerCommand = vendetta.commands.registerCommand;

      if (typeof storage.customDate === "undefined") storage.customDate = "2016-01-01";
      if (typeof storage.enabled === "undefined") storage.enabled = true;

      var UserStore = findByStoreName("UserStore");
      var SnowflakeUtils = findByProps("extractTimestamp");

      if (SnowflakeUtils && typeof SnowflakeUtils.extractTimestamp === "function") {
        patches.push(
          after("extractTimestamp", SnowflakeUtils, function (args, res) {
            if (!storage.enabled) return res;
            var id = args[0];
            var currentUser = UserStore && UserStore.getCurrentUser ? UserStore.getCurrentUser() : null;
            if (currentUser && id === currentUser.id) {
              var ts = parseDateToTimestamp(storage.customDate);
              if (ts !== null) return ts;
            }
            return res;
          })
        );
      }

      if (typeof registerCommand === "function") {
        unregisterCommand = registerCommand({
          name: "setdate",
          displayName: "setdate",
          description: "Locally change your displayed Discord account creation date (YYYY-MM-DD)",
          displayDescription: "Locally change your displayed Discord account creation date (YYYY-MM-DD)",
          type: 1,
          inputType: 1,
          options: [
            {
              name: "date",
              displayName: "date",
              description: "Date in YYYY-MM-DD format (e.g. 2016-05-13), or 'off' to reset",
              displayDescription: "Date in YYYY-MM-DD format (e.g. 2016-05-13), or 'off' to reset",
              type: 3,
              required: true,
            },
          ],
          execute: function (args) {
            var firstArg = args && args[0] ? args[0].value : "";
            var foundArg = null;
            if (Array.isArray(args)) {
              for (var i = 0; i < args.length; i++) {
                if (args[i] && args[i].name === "date") {
                  foundArg = args[i];
                  break;
                }
              }
            }
            var input = String((foundArg && foundArg.value) || firstArg || "").trim();

            if (input.toLowerCase() === "off" || input.toLowerCase() === "reset") {
              storage.enabled = false;
              return {
                content: "Account creation date spoof disabled. Re-open your profile to see your original date.",
              };
            }

            var ts = parseDateToTimestamp(input);
            if (ts === null) {
              return {
                content: "Invalid date format. Use `YYYY-MM-DD` (for example: `2016-05-13`) or `off`.",
              };
            }

            storage.customDate = input;
            storage.enabled = true;
            var unixSeconds = Math.floor(ts / 1000);

            return {
              content: "Local account creation date updated to **" + input + "** (<t:" + unixSeconds + ":D>). Re-open your profile card to refresh it.",
            };
          },
        });
      }
    },

    onUnload: function () {
      for (var i = 0; i < patches.length; i++) {
        try {
          if (typeof patches[i] === "function") patches[i]();
        } catch (e) {}
      }
      patches = [];
      if (typeof unregisterCommand === "function") {
        try {
          unregisterCommand();
        } catch (e) {}
        unregisterCommand = null;
      }
    },
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = plugin;
  }
  return plugin;
})();
