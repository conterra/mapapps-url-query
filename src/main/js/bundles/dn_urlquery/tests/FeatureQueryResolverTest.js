/*
 * Copyright (C) 2024 con terra GmbH (info@conterra.de)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {assert} from "chai";
import module from "module";
import FeatureQueryResolver from "../FeatureQueryResolver";

describe(module.id, function () {
	let resolver;

	beforeEach(function () {
		resolver = new FeatureQueryResolver();
	});

	it("get property with same case", function () {
		const obj = {
			"foo": "bar"
		};

		assert.equal(
			resolver._getPropertyIgnoreCase(obj, "foo"),
			"bar"
		);
	});

	it("get property with different case", function () {
		const obj = {
			"Foo": "Bar"
		};

		assert.equal(
			resolver._getPropertyIgnoreCase(obj, "foo"),
			"Bar"
		);
	});

	it("get right property, if properties only differ in case", function () {
		const obj = {
			"foo": "bar",
			"Foo": "Bar",
			"fOo": "bAr",
			"foO": "baR",
			"FOO": "BAR"
		};

		assert.equal(
			resolver._getPropertyIgnoreCase(obj, "fOo"),
			"bAr"
		);
	});

	// method mergeArrays
	it("merge two arrays", function () {
		const array1 = [1, 2, 3];
		const array2 = [4, 5, 6];

		const mergedArray = resolver._mergeArrays(array1, array2);

		assert.equal(mergedArray.length, array1.length + array2.length);
		for (let i = 0; i < mergedArray.length; i++) {
			assert.equal(mergedArray[i], i + 1);
		}
	});

	it("merge more than two arrays", function () {
		const array1 = [1, 2, 3];
		const array2 = [4, 5, 6];
		const array3 = [7, 8, 9];
		const array4 = [10, 11, 12];
		const array5 = [13, 14, 15];
		const array6 = [16, 17, 18];

		const mergedArray = resolver._mergeArrays(array1, array2, array3, array4, array5, array6);

		assert.equal(mergedArray.length,
			array1.length
            + array2.length
            + array3.length
            + array4.length
            + array5.length
            + array6.length
		);
		for (let i = 0; i < mergedArray.length; i++) {
			assert.equal(mergedArray[i], i + 1);
		}
	});

	it("merge arrays with same content", function () {
		const array1 = [1, 2, 3];
		const array2 = array1.slice(0);

		const mergedArray = resolver._mergeArrays(array1, array2);

		assert.equal(mergedArray.length, array1.length);
		for (let i = 0; i < mergedArray.length; i++) {
			assert.equal(mergedArray[i], array1[i]);
		}
	});

	it("merge arrays with duplicates, but not same", function () {
		const array1 = [1, 2, 3];
		const array2 = [];

		for (let i = 0; i < array1.length; i++) {
			array2[i] = array1[i] + array1.length;
		}
		array2[1] = array1[1];

		const mergedArray = resolver._mergeArrays(array1, array2);

		assert.equal(mergedArray.length, array1.length + array2.length - 1);
	});

	it("merge only one array", function () {
		const array = [];
		for (let i = 0; i < 101; i++) {
			array[i] = (i + 1) / 3;
		}

		const mergedArray = resolver._mergeArrays(array);

		assert.equal(mergedArray.length, array.length);
		for (let i = 0; i < mergedArray.length; i++) {
			assert.equal(mergedArray[i], array[i]);
		}
	});

	// getStoreId
	it("get store id in right priority order", function () {
		const store = {
			id: "store.id",
			storeId: "store.storeId"
		};
		const properties = {
			id: "properties.id",
			storeId: "properties.storeId"
		};

		assert.equal(
			resolver.getStoreId(store, properties),
			"properties.id"
		);

		delete properties.id;
		assert.equal(
			resolver.getStoreId(store, properties),
			"properties.storeId"
		);

		delete properties.storeId;
		assert.equal(
			resolver.getStoreId(store, properties),
			"store.id"
		);

		delete store.id;
		assert.equal(
			resolver.getStoreId(store, properties),
			"store.storeId"
		);
	});
});
