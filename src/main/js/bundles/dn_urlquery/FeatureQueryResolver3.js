define([
	"dojo/_base/declare",
	"dojo/_base/lang",
	"dojo/_base/array",
	"dojo/string",
	"dojo/aspect",
	"dojo/promise/all",
	"esri/geometry/Geometry",
	"esri/geometry/jsonUtils",
	"ct/_lang",
	"ct/_when",
	"ct/array",
	"ct/mapping/geometry",
	"ct/mapping/edit/GraphicsRenderer",
	"ct/mapping/edit/SymbolTableLookupStrategy"
], function (declare,
			 d_lang,
			 d_array,
			 d_string,
			 d_aspect,
			 promise_all,
			 Geometry,
			 geom_jsonUtils,
			 ct_lang,
			 ct_when,
			 ct_array,
			 ct_geometry,
			 GraphicsRenderer,
			 SymbolTableLookupStrategy) {
	return declare([], {
		constructor: function (args) {
			this.stores = {};
			this.filters = {};
			this.options = {};

			this.propFilters = {};
			this.propOptions = {};
			this.propOperators = {};
			this.propStoreNotifies = {};
			this.propStoreZoom = {};

			this.urlFilters = {};
			this.urlOptions = {};

			this.items = {};
			this.graphics = {};
		},
		activate: function () {
			this.inherited(arguments);

			this.i18n = this._i18n.get();

			var self = this;
			var eraseTool = this._eraseTool;
			if (!!eraseTool) {
				d_aspect.after(eraseTool, "_clearGraphics", function (originalMethod) {
					self.getRenderer().clear();
					self.graphics = {};
					self.items = {};
				});
			}

			var properties = this._properties || {};

			var notify = properties.notifications;
			if (notify === undefined) {
				notify = true
			} else {
				notify = !!notify
			}

			var zoom = properties.zoomToResults;
			zoom['activate'] = !!zoom.activate;

			var propStores = properties.stores;
			for (var storeId in propStores) {
				var propStore = propStores[storeId];

				var propFilter = propStore.filter;
				if (!this._isEmpty(propFilter)) {
					this.propFilters[storeId] = propFilter;
					this.propOperators[storeId] = propStore.operator || "$and";
				}

				var propOptions = propStore.options;
				if (!this._isEmpty(propOptions)) {
					this.propOptions[storeId] = propOptions;
				}

				var propStoreNotify = propStore.notifications;
				if (propStoreNotify === undefined) {
					this.propStoreNotifies[storeId] = notify;
				} else {
					this.propStoreNotifies[storeId] = !!propStoreNotify;
				}

				var propStoreZoom = propStore.zoomToResults;
				if (propStoreZoom === undefined) {
					this.propStoreZoom[storeId] = zoom;
				} else {
					this.propStoreZoom[storeId] = {};
					ct_lang.merge(this.propStoreZoom[storeId], zoom, propStoreZoom);
				}
			}

			var symbols = properties.symbols;
			if (!this._isEmpty(symbols)) {
				this.symbols = symbols;
				delete this.renderer;
			}

			this.queryAll();
		},

		/**
		 * Takes a decoded JSON URL object. Decodes incoming parameters. Filters only the parameters from the url which are necessary for this component.
		 * @param urlObject input url object
		 */
		decodeURLParameter: function (/**JSON*/ urlObject) {
			urlObject = urlObject || {};

			var queryString = this._getPropertyIgnoreCase(urlObject, "FeatureQuery");
			if (queryString === undefined)
				return;

			var query = JSON.parse(queryString);
			for (var storeId in query) {
				this.urlFilters[storeId] = query[storeId].filter;
				this.urlOptions[storeId] = query[storeId].options;
			}

			this.queryAll();
		},

		addStore: function (store, properties) {
			var storeId = this.getStoreId(store, properties);

			if (storeId) {
				this.stores[storeId] = store;
			}

			this.queryStores([storeId]);
		},
		removeStore: function (store, properties) {
			var storeId = this.getStoreId(store, properties);

			if (!!storeId) {
				this.removeGraphics(storeId);
				delete this.stores[storeId];
			}
		},

		_isEmpty: function (item) {
			// check default undefined
			if (ct_lang.isEmpty(item)) {
				return true;
			}

			// check length property
			var length = item.length;
			if (length > 0) {
				return false;
			}
			// already done by ct_lang.isEmpty
			/*if (length === 0) {
			 return true;
			 }*/

			// check if it is an object and has properties
			if (!d_lang.isObject(item)) {
				return true;
			}
			for (var key in item) {
				if (item.hasOwnProperty(key)) {
					return false;
				}
			}

			return true;
		},
		_getPropertyIgnoreCase: function (/**Object*/ object, /**string*/ property) {
			if (object.hasOwnProperty(property)) {
				return object[property];
			}

			var lowerProperty = property.toLowerCase();

			for (var prop in object) {
				if (prop.toLowerCase() == lowerProperty)
					return object[prop];
			}

			return undefined;
		},
		_mergeArrays: function () {
			var result = [];

			for (var i = 0; i < arguments.length; i++) {
				d_array.forEach(arguments[i], function (element) {
					ct_array.arrayAdd(result, element);
				}, this);
			}

			return result;
		},
		_ensureTop: function (mapModel, graphicsNode) {
			var pane = mapModel.getGlassPaneLayer();
			var oldPos = pane.indexOfChild(graphicsNode);
			if (oldPos > 0) {
				pane.moveChild(oldPos, 0);
				return false;
			}
			return true;
		},
		_getCurrentMapCRS: function () {
			var mapState = this._mapState;
			var wkid = mapState && mapState.getSpatialReference().wkid;
			return wkid;
		},
		_transformGeometry: function (item) {
			var geom = item.geometry;
			if (!geom) {
				console.warn("OmniSearchModel: search result contains no geometry, cannot show/draw item on map!");
			}
			if (geom && !(geom instanceof Geometry)) {
				console.warn("OmniSearchModel: geometry is not an esri.geometry.Geometry! Try to parse plain json from it!");
				try {
					geom = item.geometry = geom_jsonUtils.fromJson(geom);
				} catch (e) {
					console.warn("OmniSearchModel: geometry (" + geom + ") is not an esri.geometry.Geometry! Parsing failed: " + e, e);
					// clear from result
					item.geometry = undefined;
					geom = undefined;
				}
			}
			var mapWkid = this._getCurrentMapCRS();
			var coordinateTransformer = this._coordinateTransformer;
			if (mapWkid && coordinateTransformer) {
				var extent = item.extent;
				if (extent) {
					item = ct_when(coordinateTransformer.transform(extent, mapWkid), function (extent) {
						item.extent = extent;
						return item;
					}, this);
				}
				if (geom) {
					item = ct_when(coordinateTransformer.transform(geom, mapWkid), function (geometry) {
						item.geometry = geometry;
						return item;
					}, this);
				}
			}
			return item;
		},
		_zoomTo: function (extent, factor, defaultScale) {
			if (extent.getHeight() !== 0 || extent.getWidth() !== 0) {
				this._mapState.setExtent(extent.expand(factor));
			} else {
				this._mapState.centerAndZoomToScale(extent.getCenter(), defaultScale);
			}
		},

		getRequestedStores: function () {
			return this._mergeArrays(
				Object.keys(this.urlFilters),
				Object.keys(this.urlOptions)
			);
		},

		getStoreId: function (store, properties) {
			properties = properties || {};
			// properties are the important ones and can overwrite ids transported over the store
			return properties.id || properties.storeId || store.id || store.storeId;
		},

		getRenderer: function () {
			var renderer = this.renderer;

			if (!!renderer) {
				return renderer;
			}

			var mapModel = this._mapModel;

			var renderer = this.renderer = GraphicsRenderer.createForGraphicsNode("URLQuery", mapModel);
			if (!this._isEmpty(this.symbols)) {
				var lookupTable = {lookupTable: this.symbols};
				var lookupStrategy = new SymbolTableLookupStrategy(lookupTable);
				if (this._isEmpty(lookupStrategy.lookupTable)) {
					lookupStrategy["lookupTable"] = lookupTable;
				}
				renderer._setSymbolLookupStrategy(lookupStrategy);
			}

			if (renderer.hasNodeCreated || !this._ensureTop(mapModel, renderer.graphicsNode)) {
				mapModel.fireModelStructureChanged({
					source: this
				});
			}

			return renderer;
		},

		removeGraphics: function (/**string*/ storeId, renderer) {
			var ren = renderer || this.getRenderer();

			d_array.forEach(this.graphics[storeId], function (graphic) {
				ren.erase(graphic);
				ct_array.arrayRemove(this.graphics[storeId], graphic);
			}, this);
		},

		queryFeatures: function (/**string*/ storeId, renderer) {
			var ren = renderer || this.getRenderer();

			this.removeGraphics(storeId, ren);

			var featureQuery = this.stores[storeId].query(this.filters[storeId], this.options[storeId]);
			return ct_when(featureQuery, function (results) {
				var items = d_array.filter(results, function (result) {
					return !!result.geometry;
				});

				if (items.length < 1) {
					return;
				}

				var transItems = d_array.map(items, function (item) {
					return this._transformGeometry(item);
				}, this);

				return ct_when(promise_all(transItems), function (items) {
					d_array.forEach(items, function (item) {
						var graphics = this.graphics[storeId] || [];
						ct_array.arrayAdd(
							graphics,
							ren.draw(item)
						);
						this.graphics[storeId] = graphics;
					}, this);

					this.items[storeId] = items;
				}, this);
			}, this);
		},

		queryStores: function (/**array*/ storeIds) {
			var renderer = this.getRenderer();
			var storeQueries = [];

			d_array.forEach(storeIds, function (storeId) {
				var store = this.stores[storeId];
				var filter = this.filters[storeId];
				var option = this.options[storeId];

				if (
					store === undefined
					|| (filter === undefined && option === undefined)
				) {
					return;
				}

				option = option || {};

				var maxCount = option["count"];
				if (maxCount === undefined) {
					maxCount = -1;
				} else if (maxCount == 0) {
					return;
				}

				filter = filter || {};

				if (maxCount > 0) {
					var countOptions = d_lang.clone(option);
					ct_lang.merge(countOptions, {
						count: 0
					});

					// remove the sort operation, because it is not supported on counting requests
					delete countOptions.sort;

					var countQuery = store.query(filter, countOptions);

					storeQueries.push(
						ct_when(countQuery, function (result) {
							var total = result["total"];

							var notifiy = (
								this._log !== undefined
								&& this.propStoreNotifies[storeId]
							);

							if (total === undefined) {
								if (notifiy) {
									this._log.error(d_string.substitute(this.i18n.notifications.totalError, {
										store: storeId
									}));
								}

								return;
							}

							if (total <= maxCount) {
								return this.queryFeatures(storeId, renderer);
							} else if (notifiy) {
								this._log.warn(d_string.substitute(this.i18n.notifications.tooManyFeatures, {
									store: storeId
								}));
							}
						}, this)
					);
				} else {
					storeQueries.push(this.queryFeatures(storeId, renderer));
				}
			}, this);

			ct_when(promise_all(storeQueries), function () {
				var overallZoom = {
					factor: Number.MIN_VALUE,
					defaultScale: 1
				};

				var items = [];
				var geometries = [];
				d_array.forEach(storeIds, function (storeId) {
					var storedItems = this.items[storeId];
					if (!!storedItems && storedItems.length > 0) {
						items = this._mergeArrays(items, d_array.map(storedItems, function (item) {
							return {
								item: item,
								storeId: storeId
							};
						}));
					}

					var zoom = this.propStoreZoom[storeId];

					if (!zoom || !(zoom.activate) || !storedItems)
						return;

					if (!!(zoom.factor))
						overallZoom.factor = Math.max(overallZoom.factor, zoom.factor);

					if (!!(zoom.defaultScale))
						overallZoom.defaultScale = Math.max(overallZoom.defaultScale, zoom.defaultScale);

					geometries = this._mergeArrays(geometries, d_array.map(storedItems, function (item) {
						return item.geometry;
					}));
				}, this);

				if (geometries.length > 0) {
					var overallExtent = ct_geometry.calcExtent(geometries);
					this._zoomTo(overallExtent, overallZoom.factor, overallZoom.defaultScale);
				}

				if (!!(this._properties.autoInfo) && !!(this._contentViewer) && items.length == 1) {
					var item = items[0];
					this._contentViewer.showContentInfo(item.item, {storeId: item.storeId});
				}
			}, this);
		},

		queryAll: function () {
			var storeIds = this.getRequestedStores();

			d_array.forEach(storeIds, function (storeId) {
				var propFilter = d_lang.clone(this.propFilters[storeId]);
				var urlFilter = d_lang.clone(this.urlFilters[storeId]);
				if (propFilter !== undefined && urlFilter !== undefined) {
					this.filters[storeId] = {};
					this.filters[storeId][this.propOperators[storeId]] = [
						propFilter,
						urlFilter
					];
				} else if (propFilter !== undefined) {
					this.filters[storeId] = propFilter;
				} else {
					this.filters[storeId] = urlFilter || {};
				}

				var propOptions = d_lang.clone(this.propOptions[storeId]);
				var urlOptions = d_lang.clone(this.urlOptions[storeId]);
				if (propOptions !== undefined && urlOptions !== undefined) {
					this.options[storeId] = d_lang.clone(propOptions);
					ct_lang.merge(this.options[storeId], urlOptions);

					var propCount = propOptions.count;
					var urlCount = urlOptions.count;
					var minCount = Math.min(
						isNaN(propCount) ? Infinity : propCount,
						isNaN(urlCount) ? Infinity : urlCount
					);
					if (!isNaN(minCount)) {
						this.options[storeId].count = minCount;
					}
				} else if (propOptions !== undefined) {
					this.options[storeId] = propOptions;
				} else {
					this.options[storeId] = urlOptions || {};
				}

				ct_lang.merge(this.options[storeId], {
					fields: {
						geometry: 1
					}
				});
			}, this);

			this.queryStores(storeIds);
		}
	});
});
