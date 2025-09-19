// from:
// https://github.com/isker/neogrok/blob/336e3291216bf3d30ba8b85f17cde17b999d28b1/src/lib/url-templates.ts

/**
 * Implements zoekt template evaluation
 *
 * Templates can be found in Zoekt API responses, eg:
 *
 *    "RepoURLs": {
 *        "<RepoName>": "{{URLJoinPath \"https://github.com/owner/repo\" \"blob\" .Version .Path}}"
 *    },
 * 
 *  .Version is usually a git ref (eg, a Version key in a FileMatch response)
 *  .Path can be the relative file path (eg, a FileName key in a FileMatch response)
 */

const urlJoinPathTemplate = /^{{\s*URLJoinPath\s+(?<args>.*?)\s*}}$/;

export const evaluateFileUrlTemplate = (
  template: string,
  version: string,
  path: string,
  lineNumberTemplate?: string,
  lineNumber?: number,
): string => {
    let url = '';
    const match = template.match(urlJoinPathTemplate);
    if (match?.groups) {
        const { args } = match.groups;
        url = args
            .split(/\s+/)
            .map((s) => {
                if (s === ".Version") {
                    return version.split("/").map(encodeURIComponent).join("/");
                } else if (s === ".Path") {
                    return path.split("/").map(encodeURIComponent).join("/");
                } else {
                    // It's a quoted string: https://pkg.go.dev/strconv#Quote.
                    return JSON.parse(s);
                }
            })
            .join("/");
    } else {
        url = template
            // We use the function version of replaceAll because it interprets a
            // variety of characters in strings specially. Only functions guarantee
            // literal replacement.
            .replaceAll("{{.Version}}", () => version)
            .replaceAll("{{.Path}}", () => path);
    }

    const lineFragment = (lineNumberTemplate && lineNumber !== undefined) ? lineNumberTemplate.replaceAll("{{.LineNumber}}", () => lineNumber.toString()) : '';

    return url + lineFragment;
};

export const evaluateCommitUrlTemplate = (
    template: string,
    version: string,
): string => {
    const match = template.match(urlJoinPathTemplate);
    if (match?.groups) {
        const { args } = match.groups;
        return args
            .split(/\s+/)
            .map((s) => {
                if (s === ".Version") {
                    return version.split("/").map(encodeURIComponent).join("/");
                } else {
                    // It's a quoted string: https://pkg.go.dev/strconv#Quote.
                    return JSON.parse(s);
                }
            })
            .join("/");
    } else {
        // We use the function version of replaceAll because it interprets a
        // variety of characters in strings specially. Only functions guarantee
        // literal replacement.
        return template.replaceAll("{{.Version}}", () => version);
    }
};