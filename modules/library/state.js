export let currentSheets = [];
export let filteredSheets = [];
export let normalTagCounts = new Map();
export let artistTagCounts = new Map();
export let selectedTags = new Set();
export let sortBy = 'A-Z';
export let showBookmarksOnly = false;

export function setCurrentSheets(sheets) {
    currentSheets = sheets;
}

export function setFilteredSheets(sheets) {
    filteredSheets = sheets;
}

export function setNormalTagCounts(counts) {
    normalTagCounts = counts;
}

export function setArtistTagCounts(counts) {
    artistTagCounts = counts;
}

export function addSelectedTag(tag) {
    selectedTags.add(tag);
}

export function deleteSelectedTag(tag) {
    selectedTags.delete(tag);
}

export function clearSelectedTags() {
    selectedTags.clear();
}

export function setSortBy(value) {
    sortBy = value;
}

export function setShowBookmarksOnly(value) {
    showBookmarksOnly = !!value;
}

export function toggleShowBookmarksOnly() {
    showBookmarksOnly = !showBookmarksOnly;
    return showBookmarksOnly;
}

export function replaceSelectedTags(tagsArray) {
    selectedTags.clear();
    if (Array.isArray(tagsArray)) {
        tagsArray.forEach((t) => {
            if (t) selectedTags.add(String(t));
        });
    }
}
