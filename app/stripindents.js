export function stripIndents(value) {
    if (typeof value !== 'string') {
        const processedString = value.reduce((acc, curr, i) => {
            acc += curr + (arguments[i + 1] ?? '');
            return acc;
        }, '');

        return _stripIndents(processedString);
    }

    // Remove the ```json marker if it's present
    value = value.replace(/```json\s*/, '').replace(/```$/, '');

    return _stripIndents(value);
}

function _stripIndents(value) {
    return value
        .split('\n')
        .map((line) => line.trim())
        .join('\n')
        .trimStart()
        .replace(/[\r\n]$/, '');
}
