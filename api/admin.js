const settings = require("../settings.json");

if (settings.pterodactyl) if (settings.pterodactyl.domain) {
    if (settings.pterodactyl.domain.slice(-1) == "/") settings.pterodactyl.domain = settings.pterodactyl.domain.slice(0, -1);
};

const fetch = require('node-fetch');
const fs = require("fs");
const indexjs = require("../index.js");
const adminjs = require("./admin.js");
const ejs = require("ejs");
const chalk = require('chalk');

module.exports.load = async function(app, db) {
    app.get("/setcoins", async (req, res) => {
        let theme = indexjs.get(req);

        if (!req.session.pterodactyl) return four0four(req, res, theme);

        let cacheaccount = await fetch(
            settings.pterodactyl.domain + "/api/application/users/" + (await db.get("users-" + req.session.userinfo.id)) + "?include=servers",
            {
            method: "get",
            headers: { 'Content-Type': 'application/json', "Authorization": `Bearer ${settings.pterodactyl.key}` }
            }
        );
        if (await cacheaccount.statusText == "Not Found") return four0four(req, res, theme);
        let cacheaccountinfo = JSON.parse(await cacheaccount.text());

        req.session.pterodactyl = cacheaccountinfo.attributes;
        if (cacheaccountinfo.attributes.root_admin !== true) return four0four(req, res, theme);

        let failredirect = theme.settings.redirect.failedsetcoins ? theme.settings.redirect.failedsetcoins : "/";

        let id = req.query.id;
        let coins = req.query.coins;

        if (!id) return res.redirect(failredirect + "?err=MISSINGID");
        if (!(await db.get("users-" + req.query.id))) return res.redirect(`${failredirect}?err=INVALIDID`);
        
        if (!coins) return res.redirect(failredirect + "?err=MISSINGCOINS");

        coins = parseFloat(coins);

        if (isNaN(coins)) return res.redirect(failredirect + "?err=INVALIDCOINNUMBER");

        if (coins < 0 || coins > 999999999999999) return res.redirect(`${failredirect}?err=COINSIZE`);

        if (coins == 0) {
            await db.delete("coins-" + id)
        } else {
            await db.set("coins-" + id, coins);
        }

        let successredirect = theme.settings.redirect.setcoins ? theme.settings.redirect.setcoins : "/";
        res.redirect(successredirect + "?err=none");
        if(settings.api.client.webhook.auditlogs.enabled && !settings.api.client.webhook.auditlogs.disabled.includes("ADMIN")) {
            let username = cacheaccountinfo.attributes.username;
            let tag = `${cacheaccountinfo.attributes.first_name}${cacheaccountinfo.attributes.last_name}`
            let params = JSON.stringify({
                embeds: [
                    {
                        title: "Coins Set",
                        description: `**__User:__** ${id} (<@${id}>)\n**__Admin:__** ${tag} (<@${req.session.userinfo.id}>)\n\n**Coins:** ${coins}`,
                        color: hexToDecimal("#ffff00")
                    }
                ]
            })
            fetch(`${settings.api.client.webhook.webhook_url}`, {
                method: "POST",
                headers: {
                    'Content-type': 'application/json',
                },
                body: params
            }).catch(e => console.warn(chalk.red("[WEBSITE] There was an error sending to the webhook: " + e)));
        }
    });

    app.get("/setresources", async (req, res) => {
        let theme = indexjs.get(req);
    
        if (!req.session.pterodactyl) return four0four(req, res, theme);
        
        let cacheaccount = await fetch(
            settings.pterodactyl.domain + "/api/application/users/" + (await db.get("users-" + req.session.userinfo.id)) + "?include=servers",
            {
              method: "get",
              headers: { 'Content-Type': 'application/json', "Authorization": `Bearer ${settings.pterodactyl.key}` }
            }
        );
        if (await cacheaccount.statusText == "Not Found") return four0four(req, res, theme);
        let cacheaccountinfo = JSON.parse(await cacheaccount.text());
    
        req.session.pterodactyl = cacheaccountinfo.attributes;
        if (cacheaccountinfo.attributes.root_admin !== true) return four0four(req, res, theme);
    
        let failredirect = theme.settings.redirect.failedsetresources ? theme.settings.redirect.failedsetresources : "/";
    
        if (!req.query.id) return res.redirect(`${failredirect}?err=MISSINGID`);
    
        if (!(await db.get("users-" + req.query.id))) return res.redirect(`${failredirect}?err=INVALIDID`);
    
        let successredirect = theme.settings.redirect.setresources ? theme.settings.redirect.setresources : "/";
    
        if (req.query.ram || req.query.disk || req.query.cpu || req.query.servers) {
            let ramstring = req.query.ram;
            let diskstring = req.query.disk;
            let cpustring = req.query.cpu;
            let serversstring = req.query.servers;
            let id = req.query.id;

            let currentextra = await db.get("extra-" + req.query.id);
            let extra;

            if (typeof currentextra == "object") {
                extra = currentextra;
            } else {
                extra = {
                    ram: 0,
                    disk: 0,
                    cpu: 0,
                    servers: 0
                }
            }

            if (ramstring) {
                let ram = parseFloat(ramstring);
                if (ram < 0 || ram > 999999999999999) {
                    return res.redirect(`${failredirect}?err=RAMSIZE`);
                }
                extra.ram = ram;
            }
            
            if (diskstring) {
                let disk = parseFloat(diskstring);
                if (disk < 0 || disk > 999999999999999) {
                    return res.redirect(`${failredirect}?err=DISKSIZE`);
                }
                extra.disk = disk;
            }
            
            if (cpustring) {
                let cpu = parseFloat(cpustring);
                if (cpu < 0 || cpu > 999999999999999) {
                    return res.redirect(`${failredirect}?err=CPUSIZE`);
                }
                extra.cpu = cpu;
            }

            if (serversstring) {
                let servers = parseFloat(serversstring);
                if (servers < 0 || servers > 999999999999999) {
                    return res.redirect(`${failredirect}?err=SERVERSIZE`);
                }
                extra.servers = servers;
            }
            
            if (extra.ram == 0 && extra.disk == 0 && extra.cpu == 0 && extra.servers == 0) {
                await db.delete("extra-" + req.query.id);
            } else {
                await db.set("extra-" + req.query.id, extra);
            }

            adminjs.suspend(req.query.id);

            // Just copy this and put it in the other endpoints
            let username = cacheaccountinfo.attributes.username;
            let tag = `${cacheaccountinfo.attributes.first_name}${cacheaccountinfo.attributes.last_name}`
            if(settings.api.client.webhook.auditlogs.enabled && !settings.api.client.webhook.auditlogs.disabled.includes("ADMIN")) {
                let params = JSON.stringify({
                    embeds: [
                        {
                            title: "Resources Added",
                            description: `**__User:__** ${id} (<@${id}>)\n**__Admin:__** ${tag} (<@${req.session.userinfo.id}>)\n\n**Quantity:**\n- ${ramstring}MB RAM\n- ${diskstring}MB Disk\n- ${serversstring} Servers\n- ${cpustring}% CPU`,
                            color: hexToDecimal("#ffff00")
                        }
                    ]
                })
                fetch(`${settings.api.client.webhook.webhook_url}`, {
                    method: "POST",
                    headers: {
                        'Content-type': 'application/json',
                    },
                    body: params
                }).catch(e => console.warn(chalk.red("[WEBHOOK] There was an error sending a message to the webhook:\n" + e)))
            }
            return res.redirect(successredirect + "?err=none");
        } else {
            res.redirect(`${failredirect}?err=MISSINGVARIABLES`);
        }
    });


    app.get("/setplan", async (req, res) => {
        let theme = indexjs.get(req);

        if (!req.session.pterodactyl) return four0four(req, res, theme);
        
        let cacheaccount = await fetch(
            settings.pterodactyl.domain + "/api/application/users/" + (await db.get("users-" + req.session.userinfo.id)) + "?include=servers",
            {
            method: "get",
            headers: { 'Content-Type': 'application/json', "Authorization": `Bearer ${settings.pterodactyl.key}` }
            }
        );
        if (await cacheaccount.statusText == "Not Found") return four0four(req, res, theme);
        let cacheaccountinfo = JSON.parse(await cacheaccount.text());

        req.session.pterodactyl = cacheaccountinfo.attributes;
        if (cacheaccountinfo.attributes.root_admin !== true) return four0four(req, res, theme);

        let failredirect = theme.settings.redirect.failedsetplan ? theme.settings.redirect.failedsetplan : "/";

        if (!req.query.id) return res.redirect(`${failredirect}?err=MISSINGID`);

        if (!(await db.get("users-" + req.query.id))) return res.redirect(`${failredirect}?err=INVALIDID`);

        let successredirect = theme.settings.redirect.setplan ? theme.settings.redirect.setplan : "/";

        if (!req.query.package) {
            await db.delete("package-" + req.query.id);
            adminjs.suspend(req.query.id);
            if(settings.api.client.webhook.auditlogs.enabled === true && !settings.api.client.webhook.auditlogs.disabled.includes("ADMIN")) {
                let id = req.query.id;
                let username = cacheaccountinfo.attributes.username;
                let tag = `${cacheaccountinfo.attributes.first_name}${cacheaccountinfo.attributes.last_name}`
                let params = JSON.stringify({
                    embeds: [
                        {
                            title: "Package Changed",
                            description: `**__User:__** ${id} (<@${id}>)\n**__Admin:__** ${tag} (<@${req.session.userinfo.id}>)\n\n**Package:** ${req.query.package}`,
                            color: hexToDecimal("#ffff00")
                        }
                    ]
                })
                fetch(`${settings.api.client.webhook.webhook_url}`, {
                    method: "POST",
                    headers: {
                        'Content-type': 'application/json',
                    },
                    body: params
                }).catch(e => console.warn(chalk.red("[WEBHOOK] There was an error sending a message to the webhook:\n" + e)));
            }
            fetch(`${settings.api.client.webhook.webhook_url}`, {
                method: "POST",
                headers: {
                    'Content-type': 'application/json',
                },
                body: params
            }).catch(e => console.warn(chalk.red("[WEBHOOK] There was an error sending a message to the webhook:\n" + e)))
            return res.redirect(successredirect + "?err=none");
        } else {
            let newsettings = JSON.parse(fs.readFileSync("./settings.json").toString());
            if (!newsettings.api.client.packages.list[req.query.package]) return res.redirect(`${failredirect}?err=INVALIDPACKAGE`);
            await db.set("package-" + req.query.id, req.query.package);
            adminjs.suspend(req.query.id);
            if(settings.api.client.webhook.auditlogs.enabled === true && !settings.api.client.webhook.auditlogs.disabled.includes("ADMIN")) {
                let id = req.query.id;
                let username = cacheaccountinfo.attributes.username;
                let tag = `${cacheaccountinfo.attributes.first_name}${cacheaccountinfo.attributes.last_name}`
                let params = JSON.stringify({
                    embeds: [
                        {
                            title: "Package Changed",
                            description: `**__User:__** ${id} (<@${id}>)\n**__Admin:__** ${tag} (<@${req.session.userinfo.id}>)\n\n**Package:** ${req.query.package}`,
                            color: hexToDecimal("#ffff00")
                        }
                    ]
                })
                fetch(`${settings.api.client.webhook.webhook_url}`, {
                    method: "POST",
                    headers: {
                        'Content-type': 'application/json',
                    },
                    body: params
                }).catch(e => console.warn(chalk.red("[WEBHOOK] There was an error sending a message to the webhook:\n" + e)));
            }
            return res.redirect(successredirect + "?err=none");
        }
    });
    
    app.get("/getip", async (req, res) => {
        let theme = indexjs.get(req);

        if (!req.session.pterodactyl) return four0four(req, res, theme);

        let cacheaccount = await fetch(
            settings.pterodactyl.domain + "/api/application/users/" + (await db.get("users-" + req.session.userinfo.id)) + "?include=servers",
            {
            method: "get",
            headers: { 'Content-Type': 'application/json', "Authorization": `Bearer ${settings.pterodactyl.key}` }
            }
        );
        if (await cacheaccount.statusText == "Not Found") return four0four(req, res, theme);
        let cacheaccountinfo = JSON.parse(await cacheaccount.text());

        req.session.pterodactyl = cacheaccountinfo.attributes;
        if (cacheaccountinfo.attributes.root_admin !== true) return four0four(req, res, theme);

        let failredirect = theme.settings.redirect.failedgetip ? theme.settings.redirect.failedgetip : "/";
        let successredirect = theme.settings.redirect.getip ? theme.settings.redirect.getip : "/";
        if (!req.query.id) return res.redirect(`${failredirect}?err=MISSINGID`);

        if (!(await db.get("users-" + req.query.id))) return res.redirect(`${failredirect}?err=INVALIDID`);

        if (!(await db.get("ip-" + req.query.id))) return res.redirect(`${failredirect}?err=NOIP`);
        let ip = await db.get("ip-" + req.query.id);
        return res.redirect(successredirect + "?err=NONE&ip=" + ip)
    });

    async function four0four(req, res, theme) {
        ejs.renderFile(
            `./themes/${theme.name}/${theme.settings.notfound}`, 
            await eval(indexjs.renderdataeval),
            null,
        function (err, str) {
            delete req.session.newaccount;
            if (err) {
                console.log(`[WEBSITE] An error has occured on path ${req._parsedUrl.pathname}:`);
                console.log(err);
                return res.send("An error has occured while attempting to load this page. Please contact an administrator to fix this.");
            };
            res.status(404);
            res.send(str);
        });
    }

    module.exports.suspend = async function(discordid) {
        let newsettings = JSON.parse(fs.readFileSync("./settings.json").toString());
        if (newsettings.api.client.allow.overresourcessuspend !== true) return;

        let canpass = await indexjs.islimited();
        if (canpass == false) {
            setTimeout(
                async function() {
                    adminjs.suspend(discordid);
                }, 1
            )
            return;
        };

        indexjs.ratelimits(1);
        let pterodactylid = await db.get("users-" + discordid);
        let userinforeq = await fetch(
            settings.pterodactyl.domain + "/api/application/users/" + pterodactylid + "?include=servers",
            {
              method: "get",
              headers: { 'Content-Type': 'application/json', "Authorization": `Bearer ${settings.pterodactyl.key}` }
            }
          );
        if (await userinforeq.statusText == "Not Found") {
            console.log("[WEBSITE] An error has occured while attempting to check if a user's server should be suspended.");
            console.log("- Discord ID: " + discordid);
            console.log("- Pterodactyl Panel ID: " + pterodactylid);
            return;
        }
        let userinfo = JSON.parse(await userinforeq.text());

        let packagename = await db.get("package-" + discordid);
        let package = newsettings.api.client.packages.list[packagename ? packagename : newsettings.api.client.packages.default];

        let extra = 
            await db.get("extra-" + discordid) ?
            await db.get("extra-" + discordid) :
            {
                ram: 0,
                disk: 0,
                cpu: 0,
                servers: 0
            };

        let plan = {
            ram: package.ram + extra.ram,
            disk: package.disk + extra.disk,
            cpu: package.cpu + extra.cpu,
            servers: package.servers + extra.servers
        }

        let current = {
            ram: 0,
            disk: 0,
            cpu: 0,
            servers: userinfo.attributes.relationships.servers.data.length
        }
        for (let i = 0, len = userinfo.attributes.relationships.servers.data.length; i < len; i++) {
            current.ram = current.ram + userinfo.attributes.relationships.servers.data[i].attributes.limits.memory;
            current.disk = current.disk + userinfo.attributes.relationships.servers.data[i].attributes.limits.disk;
            current.cpu = current.cpu + userinfo.attributes.relationships.servers.data[i].attributes.limits.cpu;
        };

        indexjs.ratelimits(userinfo.attributes.relationships.servers.data.length);
        if (current.ram > plan.ram || current.disk > plan.disk || current.cpu > plan.cpu || current.servers > plan.servers) {
            for (let i = 0, len = userinfo.attributes.relationships.servers.data.length; i < len; i++) {
                let suspendid = userinfo.attributes.relationships.servers.data[i].attributes.id;
                await fetch(
                    settings.pterodactyl.domain + "/api/application/servers/" + suspendid + "/suspend",
                    {
                      method: "post",
                      headers: { 'Content-Type': 'application/json', "Authorization": `Bearer ${settings.pterodactyl.key}` }
                    }
                  );
            }
        } else {
            if (settings.api.client.allow.renewsuspendsystem.enabled == true) return;
            for (let i = 0, len = userinfo.attributes.relationships.servers.data.length; i < len; i++) {
                let suspendid = userinfo.attributes.relationships.servers.data[i].attributes.id;
                await fetch(
                    settings.pterodactyl.domain + "/api/application/servers/" + suspendid + "/unsuspend",
                    {
                      method: "post",
                      headers: { 'Content-Type': 'application/json', "Authorization": `Bearer ${settings.pterodactyl.key}` }
                    }
                  );
            }
        };
    }
};

function hexToDecimal(hex) {
    return parseInt(hex.replace("#",""), 16)
  }
