export class SearchableList {
    constructor(jsonList, listContainer, searchInput, selectedItemsContainer, key, onListUpdated) {
        this.jsonList = jsonList;
        this.listContainer = listContainer;
        this.searchInput = searchInput;
        this.selectedItemsContainer = selectedItemsContainer;
        this.selectedItems = [];
        this.key = key;
        this.onListUpdated = onListUpdated;
        this.renderList(jsonList);

        this.searchInput.addEventListener('input', () => {
            this.filterList(this.searchInput.value);
        });
    }

    // Helper function to get nested property
    getNestedProperty(obj, key) {
        return key.split('.').reduce((o, x) => (o == undefined || o == null ? o : o[x]), obj);
    }

    renderList(items) {
        this.listContainer.innerHTML = '';
        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'list-item';
            div.textContent = this.getNestedProperty(item, this.key);
            div.addEventListener('click', () => this.addItemToSelectedList(item));
            this.listContainer.appendChild(div);
        });
    }

    filterList(query) {
        const filteredItems = this.jsonList.filter(item => {
            const value = this.getNestedProperty(item, this.key);
            return value && value.toLowerCase().includes(query.toLowerCase());
        });
        this.renderList(filteredItems);
    }

    addItemToSelectedList(item) {
        if (!this.selectedItems.some(selectedItem => selectedItem.topicId === item.topicId)) {
            this.selectedItems.push(item);
            this.renderSelectedItems();
            this.onListUpdated(this.selectedItems);
        }
    }

    removeItemFromSelectedList(item) {
        this.selectedItems = this.selectedItems.filter(selectedItem => selectedItem.topicId !== item.topicId);
        this.renderSelectedItems();
        this.onListUpdated(this.selectedItems);
    }

    renderSelectedItems() {
        this.selectedItemsContainer.innerHTML = '<h3>Selected Items</h3>';
        this.selectedItems.forEach(item => {
            const div = document.createElement('div');
            div.className = 'selected-item';
            div.textContent = this.getNestedProperty(item, this.key);
            div.addEventListener('click', () => this.removeItemFromSelectedList(item));
            this.selectedItemsContainer.appendChild(div);
        });
    }
}