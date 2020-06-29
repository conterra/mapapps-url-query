/*
 * Copyright (C) 2020 con terra GmbH (info@conterra.de)
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
define([
    "intern!object",
    "intern/chai!assert",
    "module",
    "../FeatureQueryResolver"
], function (registerSuite, assert, md, FeatureQueryResolver) {
    var resolver;

    registerSuite({
        name: md.id,

        "beforeEach": function () {
            resolver = new FeatureQueryResolver();
        },

        // method getPropertyIgnoreCase
        "get property with same case": function () {
            var obj = {
                "foo": "bar"
            };

            assert.equal(
                resolver._getPropertyIgnoreCase(obj, "foo"),
                "bar"
            );
        },
        "get property with different case": function () {
            var obj = {
                "Foo": "Bar"
            };

            assert.equal(
                resolver._getPropertyIgnoreCase(obj, "foo"),
                "Bar"
            );
        },
        "get right property, if properties only differ in case": function () {
            var obj = {
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
        },

        // method mergeArrays
        "merge two arrays": function () {
            var array1 = [1, 2, 3];
            var array2 = [4, 5, 6];

            var mergedArray = resolver._mergeArrays(array1, array2);

            assert.equal(mergedArray.length, array1.length + array2.length);
            for (var i = 0; i < mergedArray.length; i++) {
                assert.equal(mergedArray[i], i + 1);
            }
        },
        "merge more than two arrays": function () {
            var array1 = [1, 2, 3];
            var array2 = [4, 5, 6];
            var array3 = [7, 8, 9];
            var array4 = [10, 11, 12];
            var array5 = [13, 14, 15];
            var array6 = [16, 17, 18];

            var mergedArray = resolver._mergeArrays(array1, array2, array3, array4, array5, array6);

            assert.equal(mergedArray.length,
                array1.length
                + array2.length
                + array3.length
                + array4.length
                + array5.length
                + array6.length
            );
            for (var i = 0; i < mergedArray.length; i++) {
                assert.equal(mergedArray[i], i + 1);
            }
        },
        "merge arrays with same content": function () {
            var array1 = [1, 2, 3];
            var array2 = array1.slice(0);

            var mergedArray = resolver._mergeArrays(array1, array2);

            assert.equal(mergedArray.length, array1.length);
            for (var i = 0; i < mergedArray.length; i++) {
                assert.equal(mergedArray[i], array1[i]);
            }
        },
        "merge arrays with duplicates, but not same": function () {
            var array1 = [1, 2, 3];
            var array2 = [];

            for (var i = 0; i < array1.length; i++) {
                array2[i] = array1[i] + array1.length;
            }
            array2[1] = array1[1];

            var mergedArray = resolver._mergeArrays(array1, array2);

            assert.equal(mergedArray.length, array1.length + array2.length - 1);
        },
        "merge only one array": function () {
            var array = [];
            for (var i = 0; i < 101; i++) {
                array[i] = (i + 1) / 3;
            }

            var mergedArray = resolver._mergeArrays(array);

            assert.equal(mergedArray.length, array.length);
            for (var i = 0; i < mergedArray.length; i++) {
                assert.equal(mergedArray[i], array[i]);
            }
        },

        // getStoreId
        "get store id in right priority order": function () {
            var store = {
                id: "store.id",
                storeId: "store.storeId"
            };
            var properties = {
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
        }
    });
});