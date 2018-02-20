
var formatTree = function(tree) {
    if(tree.X === undefined || tree.Y === undefined)
        return null
    return {
        location: {
            lat: tree.Y,
            lng: tree.X
        },
        properties: Object.assign({}, tree)
    }
}

var toggleDraggable

var getInfoWindow = function(content, marker) {
    if(content === null)
        content = "Not available"
    content = "<p>"+content.toLowerCase()+"</p>"
    var div = document.createElement('div');
    var toggle = document.createElement('button');
    var text = document.createElement('p')
    text.innerHTML = content;
    toggle.innerHTML = "make draggable";
    toggle.addEventListener('click', function() {marker.setDraggable(true)});
    div.appendChild(text);
    div.appendChild(toggle);
    return div
}