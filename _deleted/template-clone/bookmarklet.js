javascript: (async () => {
    if (window.location.origin != "https://railway.com") {
        alert("This bookmarklet is designed to be used with Railway");
        return;
    };

    const templateRegex = /^(?:\/new\/|\/)template\/(.{3,})$/;

    const pathname = window.location.pathname;

    const templateMatch = templateRegex.exec(pathname);

    if (templateMatch == null) {
        alert("No template was found, do you have a template page open?");
        return;
    };

    const templateId = templateMatch[1];

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

    const [template, templateError] = await gqlReq({
        operationName: "templateDetail",
        dataName: "template",
        query: "query templateDetail($code: String!) {\n template(code: $code) {\n id\n code\n createdAt\n metadata\n config\n serializedConfig\n status\n isApproved\n isV2Template\n health\n projects\n services {\n edges {\n node {\n id\n config\n }\n }\n }\n activeProjects\n creator {\n name\n avatar\n username\n hasPublicProfile\n }\n }\n }",
        variables: {
            "code": templateId
        },
    });

    if (templateError != null) {
        alert("Error retrieving data on current template" + "\n" + templateError);
        return;
    };

    if (!template.isV2Template) {
        alert("Not a v2 Template, use the v1 template cloning tool");
        return;
    };

    template.metadata.name = `${template.metadata.name} (Clone)`;

    const uuidV4Re = /[0-9(a-f|A-F)]{8}-[0-9(a-f|A-F)]{4}-4[0-9(a-f|A-F)]{3}-[89ab][0-9(a-f|A-F)]{3}-[0-9(a-f|A-F)]{12}/gm;

    let serializedConfigString = JSON.stringify(template.serializedConfig);

    const idMatches = serializedConfigString.match(uuidV4Re);

    if (idMatches == null) {
        alert("No ids found in template, something wen't really wrong");
        return;
    };

    let idMatchesUniq = [...new Set(idMatches)];

    for (i in idMatchesUniq) {
        serializedConfigString = serializedConfigString.replaceAll(idMatchesUniq[i], crypto.randomUUID());
    };

    const params = new URLSearchParams(document.location.search);

    const teamId = (params.has("teamId") == true) ? params.get("teamId") : null;

    const [templateCreateV2, templateCreateV2Error] = await gqlReq({
        operationName: "templateCreateV2",
        query: "mutation templateCreateV2($input: TemplateCreateV2Input!) {\n templateCreateV2(input: $input) {\n ...TemplateFields\n }\n}\n\nfragment TemplateFields on Template {\n id\n code\n createdAt\n demoProjectId\n userId\n teamId\n metadata\n config\n serializedConfig\n status\n isApproved\n communityThreadSlug\n isV2Template\n health\n projects\n services {\n edges {\n node {\n ...TemplateServiceFields\n }\n }\n }\n}\n\nfragment TemplateServiceFields on TemplateService {\n id\n config\n}",
        variables: {
            "input": {
                "metadata": template.metadata,
                "serializedConfig": JSON.parse(serializedConfigString),
                "teamId": teamId,
            },
        },
    });

    if (templateCreateV2Error != null) {
        alert(`Error cloning template` + "\n" + templateCreateV2Error);
        return;
    };

    alert("Template cloned successfully");
})();