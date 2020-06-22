import when from "apprt-core/when";
import customReplacer from "apprt-core/string-replace";

export default class FeatureQueryResolver {
	stores = {};
	filters = {};
	options = {};

	propFilters = {};
	propOptions = {};
	propOperators = {};
	propStoreNotifies = {};
	propStoreZoom = {};

	urlFilters = {};
	urlOptions = {};

	items = {};
	graphics = {};

	activate() {
		this.i18n = this._i18n.get();

		let properties = this._properties || {};

		let notify = properties.notifications;
		if (notify === undefined) {
			notify = true
		} else {
			notify = !!notify
		}

		let zoom = properties.zoomToResults;
		zoom['activate'] = !!zoom.activate;

		let propStores = properties.stores;
		for (let storeId in propStores) {
			let propStore = propStores[storeId];

			let propFilter = propStore.filter;
			if (!this._isEmpty(propFilter)) {
				this.propFilters[storeId] = propFilter;
				this.propOperators[storeId] = propStore.operator || "$and";
			}

			let propOptions = propStore.options;
			if (!this._isEmpty(propOptions)) {
				this.propOptions[storeId] = propOptions;
			}

			let propStoreNotify = propStore.notifications;
			if (propStoreNotify === undefined) {
				this.propStoreNotifies[storeId] = notify;
			} else {
				this.propStoreNotifies[storeId] = !!propStoreNotify;
			}

			let propStoreZoom = propStore.zoomToResults;
			if (propStoreZoom === undefined) {
				this.propStoreZoom[storeId] = zoom;
			} else {
				this.propStoreZoom[storeId] = Object.assign({}, this.propStoreZoom[storeId], zoom, propStoreZoom);
			}
		}

		let symbols = properties.symbols;
		if (!this._isEmpty(symbols)) {
			this.symbols = symbols;
		}

		this.queryAll();
	}

	/**
	 * Takes a decoded JSON URL object. Decodes incoming parameters. Filters only the parameters from the url which are necessary for this component.
	 * @param urlObject input url object
	 */
	decodeURLParameter(/**JSON*/ urlObject) {
		urlObject = urlObject || {};

		let queryString = this._getPropertyIgnoreCase(urlObject, "FeatureQuery");
		if (queryString === undefined)
			return;

		let query = JSON.parse(queryString);
		for (var storeId in query) {
			this.urlFilters[storeId] = query[storeId].filter;
			this.urlOptions[storeId] = query[storeId].options;
		}

		this.queryAll();
	}

	addStore(store, properties) {
		let storeId = this.getStoreId(store, properties);

		if (storeId) {
			this.stores[storeId] = store;
		}

		this.queryStores([storeId]);
	}

	removeStore(store, properties) {
		let storeId = this.getStoreId(store, properties);

		if (!!storeId) {
			this.removeGraphics(storeId);
			delete this.stores[storeId];
		}
	}

	_isEmpty(item) {
		if (!item)
			return false;

		// check length property
		let length = item.length;
		if (length > 0) {
			return false;
		} else if (length === 0) {
			return true;
		}

		// check if it is an object and has properties
		if (!typeof item === 'object' && item !== null) {
			return true;
		}
		for (let key in item) {
			if (item.hasOwnProperty(key)) {
				return false;
			}
		}

		return true;
	}

	_getPropertyIgnoreCase(/**Object*/ object, /**string*/ property) {
		if (object.hasOwnProperty(property)) {
			return object[property];
		}

		let lowerProperty = property.toLowerCase();

		for (let prop in object) {
			if (prop.toLowerCase() == lowerProperty)
				return object[prop];
		}

		return undefined;
	}

	_mergeArrays(...args) {
		let result = [];

		args.forEach(argument => {
			argument.forEach(element => result.push(element));
		});

		return result;
	}

	_ensureTop(mapModel, graphicsNode) {
		let pane = mapModel.getGlassPaneLayer();
		let oldPos = pane.indexOfChild(graphicsNode);
		if (oldPos > 0) {
			pane.moveChild(oldPos, 0);
			return false;
		}
		return true;
	}

	_getCurrentMapCRS() {
		let mapState = this._mapState;
		let wkid = mapState && mapState.getSpatialReference().wkid;
		return wkid;
	}

	_transformGeometry(item) {
		let geom = item.geometry;
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
		let mapWkid = this._getCurrentMapCRS();
		let coordinateTransformer = this._coordinateTransformer;
		if (mapWkid && coordinateTransformer) {
			let extent = item.extent;
			if (extent) {
				item = when(coordinateTransformer.transform(extent, mapWkid)).then(extent => {
					item.extent = extent;
					return item;
				});
			}
			if (geom) {
				item = when(coordinateTransformer.transform(geom, mapWkid)).then(geometry => {
					item.geometry = geometry;
					return item;
				});
			}
		}
		return item;
	}

	_zoomTo(extent, factor, defaultScale) {
		if (extent.getHeight() !== 0 || extent.getWidth() !== 0) {
			this._mapState.setExtent(extent.expand(factor));
		} else {
			this._mapState.centerAndZoomToScale(extent.getCenter(), defaultScale);
		}
	}

	getRequestedStores() {
		return this._mergeArrays(
			Object.keys(this.urlFilters),
			Object.keys(this.urlOptions)
		);
	}

	getStoreId(store, properties) {
		properties = properties || {};
		// properties are the important ones and can overwrite ids transported over the store
		return properties.id || properties.storeId || store.id || store.storeId;
	}

	removeGraphics(/** string */ storeId) {
		this.graphics[storeId].forEach(graphic => {
			graphic.remove();
			while ((index = this.graphics[storeId].indexOf(graphic)) > -1) {
				this.graphics[storeId].splice(index, 1);
			}
		});
	}

	queryFeatures(/**string*/ storeId) {
		this.removeGraphics(storeId);

		let featureQuery = this.stores[storeId].query(this.filters[storeId], this.options[storeId]);
		return when(featureQuery, results => {
			results.filter(result => !!result.geometry);

			if (items.length < 1) {
				return;
			}

			let transItems = items.map(item => this._transformGeometry(item));

			return when(Promise.all(transItems)).then(items => {
				items.forEach(item => {
					let graphics = this.graphics[storeId] || [];
					graphics.push(this._highlighter.highlight(item));
					this.graphics[storeId] = graphics;
				});

				this.items[storeId] = items;
			}, this);
		});
	}

	queryStores(/**array*/ storeIds) {
		let storeQueries = [];

		storeIds.forEach(storeId => {
			let store = this.stores[storeId];
			let filter = this.filters[storeId];
			let option = this.options[storeId];

			if (
				store === undefined
				|| (filter === undefined && option === undefined)
			) {
				return;
			}

			option = option || {};

			let maxCount = option["count"];
			if (maxCount === undefined) {
				maxCount = -1;
			} else if (maxCount == 0) {
				return;
			}

			filter = filter || {};

			if (maxCount > 0) {
				let countOptions = Object.assign({}, option, {count: 0});

				// remove the sort operation, because it is not supported on counting requests
				delete countOptions.sort;

				let countQuery = store.query(filter, countOptions);

				storeQueries.push(
					when(countQuery).then(result => {
						let total = result["total"];

						let notifiy = (
							this._log !== undefined
							&& this.propStoreNotifies[storeId]
						);

						const replace = customReplacer({
							valueNotFound: ""
						});

						if (total === undefined) {
							if (notifiy) {
								replace(this.i18n.notification.totalError, {
									store: storeId
								});
							}

							return;
						}

						if (total <= maxCount) {
							return this.queryFeatures(storeId);
						} else if (notifiy) {
							replace(this.i18n.notification.tooManyFeatures, {
								store: storeId
							});
						}
					}, this)
				);
			} else {
				storeQueries.push(this.queryFeatures(storeId));
			}
		});

		when(Promise.all(storeQueries)).then(() => {
			let overallZoom = {
				factor: Number.MIN_VALUE,
				defaultScale: 1
			};

			let items = [];
			let geometries = [];
			storeIds.forEach(storeId => {
				let storedItems = this.items[storeId];
				if (!!storedItems && storedItems.length > 0) {
					storedItems.map(item => {
						return {
							item: item,
							storeId: storeId
						}
					});
				}

				let zoom = this.propStoreZoom[storeId];

				if (!zoom || !(zoom.activate) || !storedItems)
					return;

				if (!!(zoom.factor))
					overallZoom.factor = Math.max(overallZoom.factor, zoom.factor);

				if (!!(zoom.defaultScale))
					overallZoom.defaultScale = Math.max(overallZoom.defaultScale, zoom.defaultScale);

				storedItems.map(item => item.geometry);
			});

			if (geometries.length > 0) {
				var overallExtent = ct_geometry.calcExtent(geometries);
				this._zoomTo(overallExtent, overallZoom.factor, overallZoom.defaultScale);
			}

			if (!!(this._properties.autoInfo) && !!(this._contentViewer) && items.length == 1) {
				var item = items[0];
				this._contentViewer.showContentInfo(item.item, {storeId: item.storeId});
			}
		}, this);
	}

	queryAll() {
		let storeIds = this.getRequestedStores();

		storeIds.forEach(storeId => {
			let propFilter = Object.assign({}, this.propFilters[storeId]);
			let urlFilter = Object.assign({}, this.urlFilters[storeId]);
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

			let propOptions = Object.assign({}, this.propOptions[storeId]);
			let urlOptions = Object.assign({}, this.urlOptions[storeId]);
			if (propOptions !== undefined && urlOptions !== undefined) {
				this.options[storeId] = Object.assign({}, propOptions, urlOptions);

				let propCount = propOptions.count;
				let urlCount = urlOptions.count;
				let minCount = Math.min(
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

			Object.assign(this.options[storeId], {fields: {geometry: 1}});
		});

		this.queryStores(storeIds);
	}
}
