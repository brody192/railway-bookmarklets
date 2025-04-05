javascript: (async () => {
    if (window.location.origin != "https://railway.com") {
        alert("This bookmarklet is designed to be used with Railway");
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

        const dataName = (options.dataName == undefined) ? options.operationName : options.dataName;

        return [res.data[dataName], null];
    };

    const tryTrim = (input) => (typeof input == "string") ? input.trim() : input;

    const [me, meError] = await gqlReq({
        operationName: "me",
        query: "query me { me { id teams { edges { node { id name preferredRegion } } } } }",
    });

    if (meError != null) {
        alert("Error retrieving data on current user" + "\n" + meError);
        return;
    };

    if (me.teams.edges.length == 0) {
        alert("You are not a part of any teams");
        return;
    };

    const currentTeamId = localStorage.getItem("@railway/dashboard/scope").replace(/['"]+/g, '');

    if (currentTeamId == null || currentTeamId == "" || currentTeamId == "null") {
        alert("No team selected, please select a team");
        return;
    };

    const [regions, regionsError] = await gqlReq({
        operationName: "regions",
        query: "query regions { regions { name country location region railwayMetal } }",
    });

    if (regionsError != null) {
        alert("Error retrieving data on regions" + "\n" + regionsError);
        return;
    };

    const friendlyRegion = (region, index) => { return tryTrim(`${region[index].location} (${region[index].region ? `${region[index].region}, ${region[index].country}` : region[index].country}) ${(region[index].railwayMetal ? `(Metal)` : "")}`) };

    const currentRegion = me.teams.edges.find(team => team.node.id == currentTeamId)?.node.preferredRegion;

    const currentFriendlyRegion = currentRegion == null ? "Not Set" : friendlyRegion(regions, regions.findIndex(region => region.name == currentRegion));

    const regionOptions = regions.map((_, index) => {
        return `${index + 1}. ${friendlyRegion(regions, index)}`;
    }).join("\n");

    const regionChoice = tryTrim(prompt(`Current region: ${currentFriendlyRegion}\nChoose a region to set as the default for your team, Enter the index:\n${regionOptions}`, ""));

    if (regionChoice == null || regionChoice == "") {
        alert("No region selected");
        return;
    };

    const regionChoiceInt = parseInt(regionChoice);

    if (isNaN(regionChoiceInt) || regionChoiceInt < 1 || regionChoiceInt > regions.length) {
        alert("Invalid region selected");
        return;
    };

    const selectedRegion = regions[regionChoiceInt - 1];

    for (const team of me.teams.edges) {
        if (team.node.id != currentTeamId) continue;

        if (team.node.preferredRegion == selectedRegion.name) {
            alert("Team already has the selected region as default");
            return;
        };
    };

    const selectedRegionFriendly = friendlyRegion(regions, regions.findIndex(region => region.name == selectedRegion.name));

    const teamName = me.teams.edges.find(team => team.node.id == currentTeamId)?.node.name;

    if (!confirm(`Are you sure you want to set the default region to "${selectedRegionFriendly}" on Team "${teamName}"?`)) {
        alert("Operation cancelled");
        return;
    };

    const [_, teamUpdateError] = await gqlReq({
        operationName: "teamUpdate",
        query: "mutation teamUpdate($id: String!, $input: TeamUpdateInput!) { teamUpdate(id: $id, input: $input) { id name preferredRegion } }",
        variables: {
            "id": currentTeamId,
            "input": {
                "preferredRegion": selectedRegion.name,
            },
        },
    });

    if (teamUpdateError != null) {
        alert("Error updating default region" + "\n" + teamUpdateError);
        return;
    };

    alert(`Default region updated successfully to "${selectedRegionFriendly}"`);
})();