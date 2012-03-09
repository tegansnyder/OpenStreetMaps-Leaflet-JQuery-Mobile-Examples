/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

 var cloudmadeUrl, cloudmadeAttrib, cloudmade;

/**
 * @name MarkerClustererOptions
 * @class This class represents optional arguments to the {@link MarkerClusterer}
 * constructor.
 * @property {Number} [maxZoom] The max zoom level monitored by a
 * marker cluster. If not given, the marker cluster assumes the maximum map
 * zoom level. When maxZoom is reached or exceeded all markers will be shown
 * without cluster.
 * @property {Number} [gridSize=60] The grid size of a cluster in pixel. Each
 * cluster will be a square. If you want the algorithm to run faster, you can set
 * this value larger.
 * @property {Array of MarkerStyleOptions} [styles]
 * Custom styles for the cluster markers.
 * The array should be ordered according to increasing cluster size,
 * with the style for the smallest clusters first, and the style for the
 * largest clusters last.
 */

/**
 * @name MarkerStyleOptions
 * @class An array of these is passed into the {@link MarkerClustererOptions}
 * styles option.
 * @property {String} [url] Image url.
 * @property {Number} [height] Image height.
 * @property {Number} [height] Image width.
 * @property {Array of Number} [opt_anchor] Anchor for label text, like [24, 12]. 
 *    If not set, the text will align center and middle.
 * @property {String} [opt_textColor="black"] Text color.
 */

/**
 * Creates a new MarkerClusterer to cluster markers on the map.
 *
 * @constructor
 * @param {GMap2} map The map that the markers should be added to.
 * @param {Array of GMarker} opt_markers Initial set of markers to be clustered.
 * @param {MarkerClustererOptions} opt_opts A container for optional arguments.
 */
function HabitatumMap(element, api_key, opt_markers, opt_opts) {
  var dis = this;
  var map =  new L.Map(element);
  
  // init open street map
  cloudmadeUrl = 'http://{s}.tile.cloudmade.com/'+api_key+'/997/256/{z}/{x}/{y}.png';
	cloudmadeAttrib = 'Map data &copy; 2011 OpenStreetMap contributors, Imagery &copy; 2011 CloudMade';
	cloudmade = new L.TileLayer(
				cloudmadeUrl, {
						maxZoom: 18, 
						attribution: cloudmadeAttrib
				}
	);
  
  var nebraska = new L.LatLng(40.95, -96.94);
  map.setView(nebraska, 10).addLayer(cloudmade);
  
  // private members
  var clusters_ = [];
  
  var maxZoom_ = 18;
  
  var gridSize_ = 50;
  
  var sizes = [30, 40, 50, 60, 70];
  var leftMarkers_ = [];
  
  var mcfn_ = null;

  /**
   * When we add a marker, the marker may not in the viewport of map, then we don't deal with it, instead
   * we add the marker into a array called leftMarkers_. When we reset MarkerClusterer we should add the
   * leftMarkers_ into MarkerClusterer.
   */
  function addLeftMarkers_() {
    if (leftMarkers_.length === 0) {
      return;
    }
    var leftMarkers = [];
    for (i = 0; i < leftMarkers_.length; ++i) {
      dis.addMarker(leftMarkers_[i], true, null, null, true);
    }
    leftMarkers_ = leftMarkers;
  }

  /**
   * Remove all markers from MarkerClusterer.
   */
  this.clearMarkers = function () {
    for (var i = 0; i < clusters_.length; ++i) {
      if (typeof clusters_[i] !== "undefined" && clusters_[i] !== null) {
        clusters_[i].clearMarkers();
      }
    }
    clusters_ = [];
    leftMarkers_ = [];
	
    this.map.off('moveend', mcfn_);
  };

  /**
   * Check a marker, whether it is in current map viewport.
   * @private
   * @return {Boolean} if it is in current map viewport
   */
  function isMarkerInViewport_(marker) {
    return map.getBounds().contains(marker.getLatLng());
  }

  /**
   * When reset MarkerClusterer, there will be some markers get out of its cluster.
   * These markers should be add to new clusters.
   * @param {Array of GMarker} markers Markers to add.
   */
  function reAddMarkers_(markers) {
    var len = markers.length;
    var clusters = [];
    for (var i = len - 1; i >= 0; --i) {
      dis.addMarker(markers[i].marker, true, markers[i].isAdded, clusters, true);
    }
    addLeftMarkers_();
  }

  /**
   * Add a marker.
   * @private
   * @param {GMarker} marker Marker you want to add
   * @param {Boolean} opt_isNodraw Whether redraw the cluster contained the marker
   * @param {Boolean} opt_isAdded Whether the marker is added to map. Never use it.
   * @param {Array of Cluster} opt_clusters Provide a list of clusters, the marker
   *     cluster will only check these cluster where the marker should join.
   */
  this.addMarker = function (marker, opt_isNodraw, opt_isAdded, opt_clusters, opt_isNoCheck) {
    if (opt_isNoCheck !== true) {
      if (!isMarkerInViewport_(marker)) {
        leftMarkers_.push(marker);
        return;
      }
    }

    var isAdded = opt_isAdded;
    var clusters = opt_clusters;
    var pos = map.project(marker.getLatLng());

    if (typeof isAdded !== "boolean") {
      isAdded = false;
    }
    if (typeof clusters !== "object" || clusters === null) {
      clusters = clusters_;
    }

    var length = clusters.length;
    var cluster = null;
    for (var i = length - 1; i >= 0; i--) {
      cluster = clusters[i];
      var center = cluster.getCenter();
      if (center === null) {
        continue;
      }
      center = map.project(center);

      // Found a cluster which contains the marker.
      if (pos.x >= center.x - gridSize_ && pos.x <= center.x + gridSize_ &&
          pos.y >= center.y - gridSize_ && pos.y <= center.y + gridSize_) {
        cluster.addMarker({
          'isAdded': isAdded,
          'marker': marker
        });
        if (!opt_isNodraw) {
          cluster.redraw();
        }
        return;
      }
    }

    // No cluster contain the marker, create a new cluster.
    cluster = new HabitatumCluster(this);
    cluster.addMarker({
      'isAdded': isAdded,
      'marker': marker
    });
    if (!opt_isNodraw) {
      cluster.redraw();
    }

    // Add this cluster both in clusters provided and clusters_
    clusters.push(cluster);
    if (clusters !== clusters_) {
      clusters_.push(cluster);
    }
  };

  /**
   * Remove a marker.
   *
   * @param {GMarker} marker The marker you want to remove.
   */

  this.removeMarker = function (marker) {
    for (var i = 0; i < clusters_.length; ++i) {
      if (clusters_[i].remove(marker)) {
        clusters_[i].redraw();
        return;
      }
    }
  };

  /**
   * Redraw all clusters in viewport.
   */
  this.redraw = function () {
    var clusters = this.getClustersInViewport_();
    for (var i = 0; i < clusters.length; ++i) {
      clusters[i].redraw(true);
    }
  };

  /**
   * Get all clusters in viewport.
   * @return {Array of Cluster}
   */
  this.getClustersInViewport_ = function () {
    var clusters = [];
    var curBounds = map.getBounds();
    for (var i = 0; i < clusters_.length; i ++) {
      if (clusters_[i].isInBounds(curBounds)) {
        clusters.push(clusters_[i]);
      }
    }
    return clusters;
  };

  /**
   * Get max zoom level.
   * @private
   * @return {Number}
   */
  this.getMaxZoom_ = function () {
    return maxZoom_;
  };

  /**
   * Get map object.
   * @private
   * @return {GMap2}
   */
  this.getmap = function () {
    return map;
  };

  /**
   * Get grid size
   * @private
   * @return {Number}
   */
  this.getGridSize_ = function () {
    return gridSize_;
  };

  /**
   * Get total number of markers.
   * @return {Number}
   */
  this.getTotalMarkers = function () {
    var result = 0;
    for (var i = 0; i < clusters_.length; ++i) {
      result += clusters_[i].getTotalMarkers();
    }
    return result;
  };

  /**
   * Get total number of clusters.
   * @return {int}
   */
  this.getTotalClusters = function () {
    return clusters_.length;
  };

  /**
   * Collect all markers of clusters in viewport and regroup them.
   */
  this.resetViewport = function () {
    var clusters = this.getClustersInViewport_();
    var tmpMarkers = [];
    var removed = 0;

    for (var i = 0; i < clusters.length; ++i) {
      var habitatumCluster = clusters[i];
      var oldZoom = habitatumCluster.getCurrentZoom();
      if (oldZoom === null) {
        continue;
      }
      var curZoom = map.getZoom();
      if (curZoom !== oldZoom) {

        // If the habitatumCluster zoom level changed then destroy the habitatumCluster
        // and collect its markers.
        var mks = habitatumCluster.getMarkers();
        for (var j = 0; j < mks.length; ++j) {
          var newMarker = {
            'isAdded': false,
            'marker': mks[j].marker
          };
          tmpMarkers.push(newMarker);
        }
        habitatumCluster.clearMarkers();
        removed++;
        for (j = 0; j < clusters_.length; ++j) {
          if (habitatumCluster === clusters_[j]) {
            clusters_.splice(j, 1);
          }
        }
      }
    }

    // Add the markers collected into marker habitatumCluster to reset
    reAddMarkers_(tmpMarkers);
    this.redraw();
  };


  /**
   * Add a set of markers.
   *
   * @param {Array of L.Marker} markers The markers you want to add.
   */
  this.addMarkers = function (markers) {
    for (var i = 0; i < markers.length; ++i) {
      this.addMarker(markers[i], true);
    }
    this.redraw();
  };

  // initialize
  if (typeof opt_markers === "object" && opt_markers !== null) {
    this.addMarkers(opt_markers);
  }

  // when map move end, regroup.
  mcfn_ = map.on('moveend', function(){
	dis.resetViewport();
  }, 
  this);
}

/**
 * Create a cluster to collect markers.
 * A cluster includes some markers which are in a block of area.
 * If there are more than one markers in cluster, the cluster
 * will create a {@link ClusterMarker_} and show the total number
 * of markers in cluster.
 *
 * @constructor
 * @private
 * @param {HabitatumMap} habitatumMap The marker cluster object
 */
function HabitatumCluster(habitatumMap) {
  var dis = this;
  
  var center_ = null;
  
  var clusterMarker = null;
  var isClusterMarkerHidden = true;
  
  var markers_ = [];
  var habitatumMap_ = habitatumMap;
  var map = habitatumMap.getmap();
  
  var zoom_ = map.getZoom();
  
	
  this.createClusterMarker = function(latlng, text, padding){
    var  marker = new L.CircleMarkerEx(latlng, { color: 'red', fillColor: '#f03', fillOpacity: 0.5, radius: 20, label: text });
		
	
	marker.on('click', function (){
	    var pos = map.project(latlng);
		var sw = new L.Point(pos.x - padding, pos.y + padding);
		sw = map.unproject(sw);
		var ne = new L.Point(pos.x + padding, pos.y - padding);
		ne = map.unproject(ne);
		var zoom = map.getBoundsZoom(new L.LatLngBounds(sw, ne), map.getSize());
		map.setView( latlng, zoom );
	});
	
	return marker;
  };

  this.removeClusterMarker = function () {
	if (null != clusterMarker){
		map.removeLayer(clusterMarker);
	}
  };
	
  this.redrawClusterMarker = function () {
  };
	
  this.hideClusterMarker = function () {
    if (null != clusterMarker){
		map.removeLayer(clusterMarker);
		isClusterMarkerHidden = true;
    }
  };
	
  this.showClusterMarker = function () {
    if (null != clusterMarker){
		map.addLayer(clusterMarker);
		isClusterMarkerHidden = false;
	}
  };
  
  /**
   * Get markers of this cluster.
   *
   * @return {Array of GMarker}
   */
  this.getMarkers = function () {
    return markers_;
  };

  /**
   * If this cluster intersects certain bounds.
   *
   * @param {GLatLngBounds} bounds A bounds to test
   * @return {Boolean} Is this cluster intersects the bounds
   */
  this.isInBounds = function (bounds) {
    if (center_ === null) {
      return false;
    }

    if (!bounds) {
      bounds = map.getBounds();
    }
    var sw = map.project(bounds.getSouthWest());
    var ne = map.project(bounds.getNorthEast());

    var centerxy = map.project(center_);
    var inViewport = true;
    var gridSize = habitatumMap_.getGridSize_();
    if (zoom_ !== map.getZoom()) {
      var dl = map.getZoom() - zoom_;
      gridSize = Math.pow(2, dl) * gridSize;
    }
    if (ne.x !== sw.x && (centerxy.x + gridSize < sw.x || centerxy.x - gridSize > ne.x)) {
      inViewport = false;
    }
    if (inViewport && (centerxy.y + gridSize < ne.y || centerxy.y - gridSize > sw.y)) {
      inViewport = false;
    }
    return inViewport;
  };

  /**
   * Get cluster center.
   *
   * @return {GLatLng}
   */
  this.getCenter = function () {
    return center_;
  };

  /**
   * Add a marker.
   *
   * @param {Object} marker An object of marker you want to add:
   *   {Boolean} isAdded If the marker is added on map.
   *   {GMarker} marker The marker you want to add.
   */
  this.addMarker = function (marker) {
    if (center_ === null) {
      center_ = marker.marker.getLatLng();
    }
    markers_.push(marker);
  };

  /**
   * Remove a marker from cluster.
   *
   * @param {GMarker} marker The marker you want to remove.
   * @return {Boolean} Whether find the marker to be removed.
   */
  this.removeMarker = function (marker) {
    for (var i = 0; i < markers_.length; ++i) {
      if (marker === markers_[i].marker) {
        if (markers_[i].isAdded) {
          markers_[i].marker.remove();
        }
        markers_.splice(i, 1);
        return true;
      }
    }
    return false;
  };

  /**
   * Get current zoom level of this cluster.
   * Note: the cluster zoom level and map zoom level not always the same.
   *
   * @return {Number}
   */
  this.getCurrentZoom = function () {
    return zoom_;
  };

  /**
   * Redraw a cluster.
   * @private
   * @param {Boolean} isForce If redraw by force, no matter if the cluster is
   *     in viewport.
   */
  this.redraw = function (isForce) {
    if (!isForce && !this.isInBounds()) {
      return;
    }

    // Set cluster zoom level.
    zoom_ = map.getZoom();
    var i = 0;
    var mz = habitatumMap_.getMaxZoom_();
    if (mz === null) {
      mz = map.getCurrentMapType().getMaximumResolution();
    }
    if (zoom_ >= mz || this.getTotalMarkers() === 1) {

      // If current zoom level is beyond the max zoom level or the cluster
      // have only one marker, the marker(s) in cluster will be showed on map.
      for (i = 0; i < markers_.length; ++i) {
        if (markers_[i].isAdded) {
          if (markers_[i].marker.isHidden()) {
            markers_[i].marker.show(map);
          }
        } else {
          markers_[i].marker.show(map);
          markers_[i].isAdded = true;
        }
      }
      
	  this.hideClusterMarker();
	  
    } else {
      // Else add a cluster marker on map to show the number of markers in
      // this cluster.
      for (i = 0; i < markers_.length; ++i) {
        if (markers_[i].isAdded && (!markers_[i].marker.isHidden())) {
          markers_[i].marker.hide();
        }
      }
      if (clusterMarker === null) {
        clusterMarker = this.createClusterMarker(center_, this.getTotalMarkers(), habitatumMap_.getGridSize_());
        this.showClusterMarker();
      } else {
        if (isClusterMarkerHidden) {
          this.showClusterMarker();
        }
        this.redrawClusterMarker(true);
      }
    }
  };

  /**
   * Remove all the markers from this cluster.
   */
  this.clearMarkers = function () {
    this.removeClusterMarker();
    for (var i = 0; i < markers_.length; ++i) {
      if (markers_[i].isAdded) {
        markers_[i].marker.remove();
      }
    }
    markers_ = [];
  };

  /**
   * Get number of markers.
   * @return {Number}
   */
  this.getTotalMarkers = function () {
    return markers_.length;
  };
}

function HabitatumMarker(latlng, text){
	this.map_ = null;
	this.latlng_ = latlng;
	this.isHidden_ = false;
	
	this.marker_ = new L.Marker(latlng);
	this.marker_.bindPopup(text);
	
	this.remove = function () {
		if (null != this.map_){
			this.map_.removeLayer(this.marker_);
		}
	};
	
	this.hide = function () {
		if (null != this.map_){	
			this.map_.removeLayer(this.marker_);
			this.isHidden_ = true;
		}
	};
	
	this.show = function (map) {
		this.map_ = map;
		this.map_.addLayer(this.marker_);
		this.isHidden_ = false;
	};
	
	this.isHidden = function () {
		return this.isHidden_;
	};
	
	this.getMarker = function(){
		return this.marker_;
	};
	
	this.getLatLng = function(){
		return this.latlng_;
	}
}

L.CircleMarkerEx = L.CircleMarker.extend({
	_label: null,
	
	initialize: function(latlng, options) {
		if (options.label){
			this._label = options.label;
		}
		L.CircleMarker.prototype.initialize.call(this, latlng, options);
	},
	
	_initPath: function() {
	
		var point = this._map.latLngToLayerPoint(this._latlng);
		
		this._container = this._createElement('g');
		
		if (this._label !== null){
			this._text = this._createElement('text');
		
			this._text.setAttribute('fill', 'black');
			this._text.setAttribute('font-size', '16');
			this._text.setAttribute('x', point.x);
			this._text.setAttribute('y', point.y);
			this._text.setAttribute('style', 'writing-mode:lr-tb; line-height:125%; text-align:center; text-anchor: middle; dominant-baseline: central; font-weight:bold;');
			this._text.textContent = this._label;
			
			this._container.appendChild(this._text);
		}
		
		this._path = this._createElement('path');		
		this._container.appendChild(this._path);
		
		this._map._pathRoot.appendChild(this._container);
	},
	
	_updatePath: function() {
		L.CircleMarker.prototype._updatePath.call(this);
		
		var point = this._map.latLngToLayerPoint(this._latlng);
		this._text.setAttribute('x', point.x);
		this._text.setAttribute('y', point.y);
	}
});