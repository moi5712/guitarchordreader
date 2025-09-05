export default class Section {
    constructor(id, type, content) {
        this.id = id;
        this.type = type;
        this.content = content;
    }

    render() {
        const sectionDiv = document.createElement('div');
        sectionDiv.id = this.id;
        sectionDiv.className = `section ${this.type}`;
        sectionDiv.innerHTML = this.content;
        return sectionDiv;
    }
}
