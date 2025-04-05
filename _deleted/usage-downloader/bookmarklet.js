javascript: (async () => {
    const htmlDoc = document.querySelector("html");

    await (async () => {
        const origin = window.location.origin;

        if (origin != "https://railway.com") {
            alert("This bookmarklet is designed to be used with Railway");
            return;
        };

        const pathname = window.location.pathname;

        if (pathname != "/account/usage") {
            alert("Please open the usage page for the desired account");
            return;
        };

        const gqlReq = async (options) => {
            const req = await fetch(`https://backboard.railway.com/graphql/internal?q=${options.operationName}`, {
                headers: {
                    "cache-control": "no-cache",
                    "content-type": "application/json",
                },
                method: "POST",
                body: JSON.stringify({
                    operationName: options.operationName,
                    query: options.query,
                    variables: options.variables,
                }),
                mode: "cors",
                credentials: "include",
            });

            if (req.status != 200) {
                return [null, Error("Non 200 status code returned from API: " + req.status)];
            };

            const res = await req.json();

            if (res.errors != undefined) {
                return [null, Error(res.errors[0].message)];
            };

            if (res.data == null) {
                return [null, Error("The API returned the null data type")];
            };

            return [res.data, null];
        };

        const urlParams = new URLSearchParams(window.location.search);

        let billingStartCycleDate;
        let billingEndCycleDate;

        const teamId = urlParams.get('teamId');

        htmlDoc.style.cursor = "wait";

        if (teamId != null) {
            const [customerForTeam, customerForTeamError] = await gqlReq({
                operationName: "customerForTeam",
                query: "query customerForTeam($id: String!) {\n team(id: $id) {\n customer {\n billingPeriod {\n start\n end\n}\n}\n}\n}",
                variables: {
                    "id": teamId
                }
            });

            if (customerForTeamError != null) {
                alert("Get billing cycle error" + "\n" + customerForTeamError);
                return;
            };

            billingStartCycleDate = new Date(customerForTeam.team.customer.billingPeriod.start);
            billingEndCycleDate = new Date(customerForTeam.team.customer.billingPeriod.end);
        } else {
            const [customerForUser, customerForUserError] = await gqlReq({
                operationName: "customerForUser",
                query: "query customerForUser {\n me {\n customer {\n billingPeriod {\n start\n end\n}\n}\n}\n}"
            });

            if (customerForUserError != null) {
                alert("Get billing cycle error" + "\n" + customerForUserError);
                return;
            };

            billingStartCycleDate = new Date(customerForUser.me.customer.billingPeriod.start);
            billingEndCycleDate = new Date(customerForUser.me.customer.billingPeriod.end);
        };

        const tryTrim = (input) => (typeof input == "string") ? input.trim() : input;

        const currentDate = new Date();

        const currentYear = currentDate.getFullYear();

        const wantedCycle = tryTrim(prompt(`Enter the cycle start year and month to download usage for, in format YYYY-MM\nCurrent billing period start date: ${billingStartCycleDate.getUTCFullYear()} ${billingStartCycleDate.getUTCMonth() + 1}-${billingStartCycleDate.getUTCDate()}\nCurrent billing period end date: ${billingEndCycleDate.getUTCFullYear()} ${billingEndCycleDate.getUTCMonth() + 1}-${billingEndCycleDate.getUTCDate()}`, `${billingStartCycleDate.getUTCFullYear()}-${billingStartCycleDate.getUTCMonth() + 1}`));
        if (wantedCycle == null) {
            alert("User canceled the prompt");
            return;
        };

        const yearMonthSplit = wantedCycle.split("-");
        if (yearMonthSplit.length != 2) {
            alert("Incorrect input value");
            return;
        };

        const year = yearMonthSplit[0];
        const month = yearMonthSplit[1];

        if (year < 2022 || year > 2026 || isNaN(year)) {
            alert("Please enter a valid year");
            return;
        };

        if (year > currentYear) {
            alert("Grabbing data from the future is not currently supported");
            return;
        };

        if (month < 1 || month > 12 || isNaN(month)) {
            alert("Please enter a valid month");
            return;
        };

        if (year == currentYear && month > billingStartCycleDate.getUTCMonth() + 1) {
            alert("Grabbing data from the future is not currently supported");
            return;
        };

        const startMonthNumber = parseInt(month);
        const endMonthNumber = (startMonthNumber == 12) ? 1 : startMonthNumber + 1;

        const startYearNumber = parseInt(year);
        const endYear = (startMonthNumber + 1 == 13) ? (startYearNumber + 1) : startYearNumber;

        const variables = {
            "usageMeasurements": [
                "MEMORY_USAGE_GB",
                "CPU_USAGE",
                "NETWORK_TX_GB",
                "DISK_USAGE_GB"
            ],
            "metricsMeasurements": [],
            "startDate": new Date(Date.UTC(
                startYearNumber,
                startMonthNumber - 1,
                billingStartCycleDate.getUTCDate(),
                billingStartCycleDate.getUTCHours(),
                billingStartCycleDate.getMinutes(),
                billingStartCycleDate.getUTCSeconds()
            )).toISOString(),
            "endDate": new Date(Date.UTC(
                endYear,
                endMonthNumber - 1,
                billingEndCycleDate.getUTCDate(),
                billingEndCycleDate.getUTCHours(),
                billingEndCycleDate.getUTCMinutes(),
                billingEndCycleDate.getUTCSeconds()
            )).toISOString(),
            "includeDeleted": false
        };

        if (teamId != null) {
            variables.teamId = teamId;
        } else {
            variables.userId = localStorage.ajs_user_id.slice(1, -1);
        };

        const [allProjectUsage, allProjectUsageError] = await gqlReq({
            operationName: "allProjectUsage",
            query: "query allProjectUsage($teamId: String, $userId: String, $usageMeasurements: [MetricMeasurement!]!, $metricsMeasurements: [MetricMeasurement!]!, $startDate: DateTime!, $endDate: DateTime!, $sampleRateSeconds: Int, $includeDeleted: Boolean) {\n usage(teamId: $teamId, userId: $userId, measurements: $usageMeasurements, groupBy: [PROJECT_ID, SERVICE_ID, PLUGIN_ID], startDate: $startDate, endDate: $endDate, includeDeleted: $includeDeleted) {\n measurement\n value\n tags {\n projectId\n}\n}\n metrics(teamId: $teamId, userId: $userId, measurements: $metricsMeasurements, startDate: $startDate, endDate: $endDate, sampleRateSeconds: $sampleRateSeconds, includeDeleted: $includeDeleted) {\n measurement\n}\n projects(first: 5000, includeDeleted: $includeDeleted, userId: $userId, teamId: $teamId) {\n edges {\n node {\n id\n name\n deletedAt\n}\n}\n}\n}",
            variables: variables
        });

        if (allProjectUsageError != null) {
            alert("Get project usage error" + "\n" + allProjectUsageError);
            return;
        };

        const chargeRates = {
            memory: 0.0002315,
            cpu: 0.000463,
            network: 0.10,
            disk: 0.00000579
        };

        let projectsObj = {
            projects: [],
        };

        for (const project of allProjectUsage.projects.edges) {
            // in code check to disable parsing of deleted projects
            if (project.node.deletedAt != null) continue;

            let projectObj = {
                name: project.node.name,
                id: project.node.id,
                values: {
                    memory: {
                        usage: 0.00,
                        cost: 0.0000
                    },
                    cpu: {
                        usage: 0.00,
                        cost: 0.0000
                    },
                    network: {
                        usage: 0.00,
                        cost: 0.0000
                    },
                    disk: {
                        usage: 0.00,
                        cost: 0.0000
                    },
                },
                total_cost: 0.0000
            };

            for (const usage of allProjectUsage.usage) {
                if (usage.tags.projectId != project.node.id) continue;

                const roundValue = Math.round(usage.value * 100) / 100;

                switch (usage.measurement) {
                    case 'MEMORY_USAGE_GB':
                        projectObj.values.memory.usage += roundValue;
                        break;
                    case 'CPU_USAGE':
                        projectObj.values.cpu.usage += roundValue;
                        break;
                    case 'NETWORK_TX_GB':
                        projectObj.values.network.usage += roundValue;
                        break;
                    case 'DISK_USAGE_GB':
                        projectObj.values.disk.usage += roundValue;
                        break;
                    default:
                        console.log(`measurement type ${usage.measurement} not accounted for`)
                };
            };

            for (const key in projectObj.values) {
                projectObj.values[key].usage = Math.round(projectObj.values[key].usage * 100) / 100;

                projectObj.values[key].cost = Math.round(projectObj.values[key].usage * chargeRates[key] * 10000) / 10000;

                projectObj.total_cost += projectObj.values[key].usage * chargeRates[key];
            };

            projectObj.total_cost = Math.round(projectObj.total_cost * 10000) / 10000;

            projectsObj.projects.push(projectObj);
        };

        const projectsObjString = JSON.stringify(projectsObj, null, 2);

        const blob = new Blob([projectsObjString], { type: 'application/json' });

        const url = window.URL.createObjectURL(blob);

        const link = document.createElement('a');

        link.href = url;

        let filename = `railway_usage_${startYearNumber}_${month}-${endMonthNumber}`;

        if (teamId != null) {
            filename += `_${teamId}`;
        };

        filename += `_${Math.floor(Date.now() / 1000)}.json`;

        link.download = filename;

        link.dispatchEvent(new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
        }));

        setTimeout(() => {
            window.URL.revokeObjectURL(url);
            link.remove();
        }, 100);
    })();

    htmlDoc.style.cursor = null;
})();