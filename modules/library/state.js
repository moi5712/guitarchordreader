export let currentSheets = [];
export let filteredSheets = [];
export let isLoading = false;
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

export function setLoading(loading) {
    isLoading = loading;
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

export function toggleShowBookmarksOnly() {
    showBookmarksOnly = !showBookmarksOnly;
    return showBookmarksOnly;
}
