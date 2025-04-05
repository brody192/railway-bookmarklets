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

    const currentRegion = me.teams.edges.find(team => team.node.id == currentTeamId)?.node.preferredRegion;

    if (currentRegion == null) {
        alert("No default region set for this team");
        return;
    };

    const tryTrim = (input) => (typeof input == "string") ? input.trim() : input;

    const friendlyRegion = (region, index) => { return tryTrim(`${region[index].location} (${region[index].region ? `${region[index].region}, ${region[index].country}` : region[index].country}) ${(region[index].railwayMetal ? `(Metal)` : "")}`) };

    const [regions, regionsError] = await gqlReq({
        operationName: "regions",
        query: "query regions { regions { name country location region railwayMetal } }",
    });

    if (regionsError != null) {
        alert("Error retrieving data on regions" + "\n" + regionsError);
        return;
    };

    const currentFriendlyRegion = friendlyRegion(regions, regions.findIndex(region => region.name == currentRegion));

    const teamName = me.teams.edges.find(team => team.node.id == currentTeamId)?.node.name;

    alert(`Default region for team "${teamName}" is "${currentFriendlyRegion}"`);
})();