javascript: (async () => {
    if (window.location.origin != "https://railway.com") {
        alert("This bookmarklet is designed to be used with Railway");
        return;
    };

    const templateRegex = /^\/template\/(.{3,})$/;

    const pathname = window.location.pathname;

    const templateMatch = templateRegex.exec(pathname);

    if (templateMatch == null) {
        alert("No template could found, do you have a template page open?");
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

    delete template.metadata.readme;

    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'text/plain' });

    const url = window.URL.createObjectURL(blob);

    window.open(url);
})();