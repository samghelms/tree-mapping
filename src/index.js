
proj4.defs("EPSG:26915", "+proj=utm +zone=15 +ellps=GRS80 +datum=NAD83 +units=m +no_defs");

var coordConverter = proj4('EPSG:3857','EPSG:26915')

var test = function(url, resourceType) {
    if(url.includes('geoint.lmic.state.mn')) {
        return {
           url: url,
           headers: { 
            "Content-Type":"image/png",
            Pragma: "no-cache",
            "Cache-Control": "no-cache",
            Accept: "image/webp,image/apng,image/*,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Access-Control-Allow-Origin": "*",
             credentials: 'same-origin',
             "X-Requested-With": 'tree-map.samghelms.github.io',
            }
        }
    }
}

var map = new mapboxgl.Map({
    container: 'map',
    style: 'https://free.tilehosting.com/styles/basic/style.json?key=obvphmK3lI8iLuugsP5L',
    center: [-91.8671, 47.9032],
    zoom: 13,
    transformRequest: test,
});

var database = firebase.database();

var singleTreeConvert = function(tree) {
    if(tree.X == null || tree.Y == null)
        return null
    return {
        type: "Feature",
        geometry: {
            type: "Point",
            coordinates: [tree.X, tree.Y],
        },
        properties: Object.assign({}, tree)
    }
}

var toGeoJson = function(trees) {
    return {
        type: "FeatureCollection",
        features: trees.map(tree=>singleTreeConvert(tree)).filter(tree => tree)
    }
}

var addTrees = function(trees) {
    treesGeojson = toGeoJson(trees)
    map.addSource("trees", {
        "type": "geojson",
        "data": treesGeojson,
        cluster: true,
        clusterMaxZoom: 14, // Max zoom to cluster points on
        clusterRadius: 50 // Radius of each cluster when clustering points (defaults to 50)
    });

    map.addLayer({
        id: "clusters",
        type: "circle",
        source: "trees",
        filter: ["has", "point_count"],
        paint: {
            // Use step expressions (https://www.mapbox.com/mapbox-gl-js/style-spec/#expressions-step)
            // with three steps to implement three types of circles:
            //   * Blue, 20px circles when point count is less than 100
            //   * Yellow, 30px circles when point count is between 100 and 750
            //   * Pink, 40px circles when point count is greater than or equal to 750
            "circle-color": "#51bbd6",
            "circle-radius": 20
        }
    });

    map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "trees",
        filter: ["has", "point_count"],
        layout: {
            "text-field": "{point_count_abbreviated}",
            "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
            "text-size": 12
        }
    });

    map.addLayer({
        "id": "tree-markers",
        "type": "circle",
        "source": "trees",
        filter: ["!has", "point_count"],
        paint: {
            "circle-color": "#11b4da",
            "circle-radius": 10,
            "circle-stroke-width": 1,
            "circle-stroke-color": "#fff"
        }
    });
}

var treeRef = firebase.database().ref('/trees');
var allTrees = treeRef.once('value').then(function(trees) {
                                              addTrees(trees.val())
                                            });

map.on('load', function () {

    var proxyurl = "https://cors-anywhere.herokuapp.com/";
    var url = "http://geoint.lmic.state.mn.us/cgi-bin/mncomp?SERVICE=WMS&REQUEST=GetMap&FORMAT=image/jpeg&TRANSPARENT=TRUE&STYLES=&VERSION=1.3.0&LAYERS=mncomp&WIDTH=256&HEIGHT=256&CRS=EPSG:26915&BBOX="; // site that doesn’t send Access-Control-*
    
    map.addSource('test', {
           "type": "raster",
            "tiles": [proxyurl + url],
            "maxzoom": 30,
            "tileSize": 256
    });

    var sourceObj = map.getSource('test');
    // console.log(sourceObj)
    var origFunc = sourceObj.loadTile;

    map.getSource('test').loadTile = function(t, cb) {
        var can = t.tileID.canonical
        var bbox = getTileBBox(can.x, can.y, can.z)
        // 583666.665597,5305162.538468,585666.665597,5307162.538468
        var origUrl = sourceObj.tiles[0].substring(0,sourceObj.tiles[0].indexOf('&BBOX'));
        var newUrl = origUrl+"&BBOX="+bbox
        this.tiles[0] = newUrl;
        return origFunc.call(this, t, cb);
    }

    map.addLayer({
        'id': 'wms-test-layer',
        'type': 'raster',
        'source': "test",
        'paint': {}
    }, 'clusters');
   

    // When a click event occurs on a feature in the places layer, open a popup at the
    // location of the feature, with description HTML from its properties.
    map.on('click', 'tree-markers', function (e) {
        var coordinates = e.features[0].geometry.coordinates.slice();
        var common = e.features[0].properties.Common
        var description = common+', '+e.features[0].properties['Adjacent House '];
        // Ensure that if the map is zoomed out such that multiple
        // copies of the feature are visible, the popup appears
        // over the copy being pointed to.
        while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
            coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
        }

        new mapboxgl.Popup()
            .setLngLat(coordinates)
            .setHTML(description)
            .addTo(map);
    });

    map.on('click', 'clusters', function (e) {
        var coordinates = e.features[0].geometry.coordinates.slice();
        var common = e.features[0].properties.Common
        var description = common+', '+e.features[0].properties['Adjacent House '];
        // console.log(e.features)
        // Ensure that if the map is zoomed out such that multiple
        // copies of the feature are visible, the popup appears
        // over the copy being pointed to.
        while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
            coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
        }

        new mapboxgl.Popup()
            .setLngLat(coordinates)
            .setHTML(description)
            .addTo(map);
    });

    // Change the cursor to a pointer when the mouse is over the places layer.
    map.on('mouseenter', 'tree-markers', function () {
        map.getCanvas().style.cursor = 'pointer';
    });

    // Change it back to a pointer when it leaves.
    map.on('mouseleave', 'tree-markers', function () {
        map.getCanvas().style.cursor = '';
    });

});


function getMercCoords(x, y, z) {
    var resolution = (2 * Math.PI * 6378137 / 256) / Math.pow(2, z),
        merc_x = (x * resolution - 2 * Math.PI  * 6378137 / 2.0),
        merc_y = (y * resolution - 2 * Math.PI  * 6378137 / 2.0);

    return [merc_x, merc_y];
}

function getTileBBox(x, y, z) {
    // for Google/OSM tile scheme we need to alter the y
    y = (Math.pow(2, z) - y - 1);

    var min = coordConverter.forward(getMercCoords(x * 256, y * 256, z)),
        max = coordConverter.forward(getMercCoords((x + 1) * 256, (y + 1) * 256, z));

    return min[0] + ',' + min[1] + ',' + max[0] + ',' + max[1];
}


