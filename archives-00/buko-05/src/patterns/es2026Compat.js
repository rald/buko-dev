export function getOrInsertPoly(map, key, defaultValue) {
  if (typeof map.getOrInsert === 'function') {
    return map.getOrInsert(key, defaultValue);
  }
  if (!map.has(key)) {
    map.set(key, defaultValue);
  }
  return map.get(key);
}

export function getOrInsertComputedPoly(map, key, computeFn) {
  if (typeof map.getOrInsertComputed === 'function') {
    return map.getOrInsertComputed(key, computeFn);
  }
  if (!map.has(key)) {
    map.set(key, computeFn());
  }
  return map.get(key);
}

export function sumPrecisePoly(values) {
  if (typeof Math.sumPrecise === 'function') {
    return Math.sumPrecise(values);
  }
  let sum = 0.0;
  let c = 0.0;
  for (const v of values) {
    const x = Number(v);
    const t = sum + x;
    if (Math.abs(sum) >= Math.abs(x)) {
      c += (sum - t) + x;
    } else {
      c += (x - t) + sum;
    }
    sum = t;
  }
  return sum + c;
}

export function isErrorPoly(val) {
  if (typeof Error.isError === 'function') {
    return Error.isError(val);
  }
  return val instanceof Error || (
    typeof val === 'object' &&
    val !== null &&
    Object.prototype.toString.call(val) === '[object Error]'
  );
}

export function concatIteratorsPoly(...iterables) {
  if (typeof Iterator !== 'undefined' && typeof Iterator.concat === 'function') {
    return Iterator.concat(...iterables);
  }
  return (function* () {
    for (const it of iterables) {
      yield* it;
    }
  })();
}
