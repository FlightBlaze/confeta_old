const fet = {
	impl: { }
}

fet.impl.calcItemOrder = function(wrapper) {
	if (wrapper.newIndex === null) {
		return wrapper.oldIndex;
	}
	return wrapper.newIndex;
}

fet.impl.createEnum = function(values) {
	const enumObject = {};
	for (const val of values) {
		enumObject[val] = val;
	}
	return Object.freeze(enumObject);
}

fet.impl.ItemStatus = fet.impl.createEnum([
	'Unchanged', 'Moved', 'Created', 'Deleted'
])

fet.impl.calcItemStatus = function(wrapper) {
	if (wrapper.oldIndex === null) {
		return fet.impl.ItemStatus.Created;
	}
	if (wrapper.newIndex === null) {
		return fet.impl.ItemStatus.Deleted;
	}
	if (wrapper.newIndex !== wrapper.oldIndex) {
		return fet.impl.ItemStatus.Moved;
	} else {
		return fet.impl.ItemStatus.Unchanged;
	}
}

fet.impl.difference = function(arrNew, arrOld) {
	const wrappers = {};
	if (arrOld !== null) {
		for (const i in arrOld) {
			const index = parseInt(i);
			const item = arrOld[index];
			wrappers[item.key] = {
				oldIndex: index,
				newIndex: null,
				itself: item
			}
		}
	}
	for (const i in arrNew) {
		const index = parseInt(i);
		const item = arrNew[index];
		if (item.key in wrappers) {
			wrappers[item.key].newIndex = index;
		} else {
			wrappers[item.key] = {
				oldIndex: null,
				newIndex: index,
				itself: item
			}
		}
	}
	return Object.values(wrappers).map(wrp => {
		return {
			...wrp,
			order: fet.impl.calcItemOrder(wrp)
		};
	}).sort((a,b) => a.order - b.order).map(wrp => {
		return {
			item: wrp.itself,
			status: fet.impl.calcItemStatus(wrp)
		};
	});
}

fet.impl.differenceDom = function(arrNew, element) {
	const children = [...element.children];
	const childInfos = children.map((child, index) => {
		return {
			element: child,
			index: parseInt(index),
			key: child.dataset.key
		};
	}).filter(child => child.key !== undefined);
	const wrappers = {};
	for (const i in childInfos) {
		const index = parseInt(i);
		const info = childInfos[index];
		wrappers[info.key] = {
			oldIndex: index,
			newIndex: null,
			itself: null,
			key: info.key
		}
	}
	for (const i in arrNew) {
		const index = parseInt(i);
		const item = arrNew[index];
		if (item.key in wrappers) {
			Object.assign(wrappers[item.key], {
				newIndex: index,
				itself: item
			});
		} else {
			wrappers[item.key] = {
				oldIndex: null,
				newIndex: index,
				itself: item,
				key: item.key
			}
		}
	}
	return Object.values(wrappers).map(wrp => {
		return {
			...wrp,
			order: fet.impl.calcItemOrder(wrp)
		};
	}).sort((a,b) => a.order - b.order).map(wrp => {
		return {
			key: wrp.key,
			item: wrp.itself,
			status: fet.impl.calcItemStatus(wrp)
		};
	});
}

fet.impl.makeRandomColor = function() {
	return "#000000".replace(/0/g, function(){
		return (~~(Math.random()*16)).toString(16);
	});
}

fet.impl.removeElement = function(element) {
	if (element.parentElement !== null) {
		const event = new Event('destroy');
		element.dispatchEvent(event);
	}
	element.remove();
}

fet.impl.onTransitionEnd = function(ev) {
	if (ev.propertyName === 'top') {
		ev.target.classList.remove('moved-item');
	}
	if (ev.target.classList.contains('deleted-item')) {
		fet.impl.removeElement(ev.target);
	}
}

fet.impl.insertChild = function(parent, child, index) {
	if (!index) {
		index = 0;
	}
	if (index >= parent.children.length) {
		parent.appendChild(child);
	} else {
		parent.insertBefore(child, parent.children[index]);
	}
}

fet.impl.applyListChangesBase = function(arrNew, parentElem, createElemFunc,
																					preserveDeletedElements = false) {
	const diff = fet.impl.differenceDom(arrNew, parentElem);
	const childByKey = {};
	let children = [...parentElem.children];
	for (const i in children) {
		const child = children[i]
		const key = child.dataset.key;
		if (key === undefined) {
			child.remove();
			continue;
		}
		childByKey[key] = {
			element: child,
			index: parseInt(i)
		};
	}
	children = [...parentElem.children];
	for (const i in diff) {
		const index = parseInt(i);
		const wrapper = diff[index];
		if (wrapper.status === fet.impl.ItemStatus.Created) {
			const element = createElemFunc(wrapper.item);
			element.dataset.key = wrapper.item.key.toString();
			fet.impl.insertChild(parentElem, element, index);
			children.splice(index, 0, element);
		}
	}
	for (const i in diff) {
		const index = parseInt(i);
		const wrapper = diff[index];
		if(wrapper.status === fet.impl.ItemStatus.Moved) {
			const childInfo = childByKey[wrapper.item.key.toString()];
			fet.impl.insertChild(parentElem, childInfo.element, index);
		}
	}
	for (const wrapper in diff) {
		if(wrapper.status === fet.impl.ItemStatus.Deleted) {
			const childInfo = childByKey[wrapper.key.toString()];
			if (!preserveDeletedElements) {
				fet.impl.removeElement(childInfo.element);
			}
		}
	}
	return diff;
}

fet.impl.cumulativeOffset = function(element) {
	let top = 0, left = 0;
	do {
		top += element.offsetTop  || 0;
		left += element.offsetLeft || 0;
		element = element.offsetParent;
	} while(element);
	return {
		top: top,
		left: left
	};
}
		
fet.impl.freeze = function(object) {
	if (typeof object === 'object') {
		Object.freeze(object);
	}
}

fet.impl.genRandomInt = function(min = 0, max = 2147483647) {
	min = Math.ceil(min);
	max = Math.floor(max);
	return Math.floor(Math.random() * (max - min) + min);
}
		
fet.impl.getScrollableParent = function(node) {
	if (node == null) {
		return null;
	}
	if (node.scrollHeight > node.clientHeight) {
		return node;
	} else {
		return fet.impl.getScrollableParent(node.parentNode);
	}
}

fet.impl.Drag = function() {
	const object = arguments[0];
	const propName = arguments[1];
	const element = arguments[2];
	let clientY = null;
	let pageY = null;
	if (!arguments[3].target) { // is options object
		const options = arguments[3];
		clientY = options.clientY;
		pageY = options.pageY;
	} else { // is Event
		const event = arguments[3];
		if (event.type.startsWith('mousedown')) {
			clientY = event.clientY;
			pageY = event.pageY;
		} else {
			throw 'Error: Event type not supported'
		}
	}
	const state = {
		object: object,
		propName: propName,
		isDragging: true,
		initialClientY: clientY,
		initialPageY: pageY,
		element: element,
		elementPos: fet.impl.cumulativeOffset(element),
		elementBounds: element.getBoundingClientRect(),
		elementY: null,
		offsetY: 0,
		mousemove: ev => {
			onmove(state, ev.clientY, ev.pageY);
		},
		mouseup: ev => {
			onup(state);
		},
		initialElementIndex: null,
		elementIndex: null,
		isOutOfBound: false,
		scrollableParent: fet.impl.getScrollableParent(element)
	};
	state.offsetY = pageY - state.elementPos.top;
	element.style.position = 'relative';
	element.style.left = '0px';
	element.style.top = '0px';
	element.classList.add('drag-item');
	element.classList.remove('moved-item');
	element.dispatchEvent(new Event('dragstart'));
	const onmove = function (state, clientY, pageY) {
		const parent = state.element.parentElement;
		const parentOffset = fet.impl.cumulativeOffset(parent);
		const children = [...parent.children];
		let y = 0;
		for (const i in children) {
			const index = parseInt(i);
			const child = children[i];
			if (child.isSameNode(state.element)) {
				if (state.elementIndex === null) {
					state.initialElementIndex = index;
					state.elementIndex = index;
				}
				continue;
			}
		}
		for (const i in children) {
			const index = parseInt(i);
			const child = children[i];
			const computedStyle = window.getComputedStyle(child);
			y = child.offsetTop - parseFloat(computedStyle.top);
			let isInside = false;
			if (index == 0) {
				isInside = pageY < y + child.offsetHeight;
				state.isOutOfBound = pageY < y;
			} else if(index == children.length - 1) {
				isInside = pageY > y;
				state.isOutOfBound = pageY > y + child.offsetHeight;
			} else {
				isInside = pageY > y && pageY < y + child.offsetHeight;
				state.isOutOfBound = false;
			}
			if (isInside) {
				if(state.elementIndex !== index) {
					const item = state.object[propName][state.elementIndex]
					const newArray = [...state.object[propName]];
					newArray.splice(state.elementIndex, 1);
					newArray.splice(index, 0, item);
					state.object[propName] = newArray;
					state.element.dispatchEvent(new CustomEvent('moveitem', {
						detail: {
							oldIndex: state.elementIndex,
							newIndex: index
						}
					}));
					child.dispatchEvent(new CustomEvent('moveitem', {
						detail: {
							oldIndex: index,
							newIndex: state.elementIndex
						}
					}));
					state.elementIndex = index;
				}
				break;
			}
		}
		state.elementPos = fet.impl.cumulativeOffset(element);
		state.elementBounds = element.getBoundingClientRect();
		const elementLayoutPos = {
			left: state.elementPos.left - parseFloat(state.element.style.left),
			top: state.elementPos.top - parseFloat(state.element.style.top),
		};
		const top = pageY - elementLayoutPos.top - state.offsetY;
		state.element.style.top = `${top}px`;
		state.elementY = top;

		// Auto scrolling when element position is near to the window border
		const scrollUpThresh = window.innerHeight * 0.2
		const scrollDownThresh = window.innerHeight * 0.8
		const scrollZoneHeight = window.innerHeight - scrollDownThresh
		const maxScrollStep = 10
		if (clientY > scrollDownThresh) {
			state.autoScrollStep = (clientY - scrollDownThresh) /
				scrollZoneHeight * maxScrollStep;
		} else if (clientY < scrollUpThresh) {
			const amount = (scrollZoneHeight - clientY) /
						scrollZoneHeight * maxScrollStep;
			state.autoScrollStep = -amount;
		} else {
			state.autoScrollStep = 0
		}
	}
	state.autoScrollInterval = setInterval(function (state) {
		if (state.elementY === null || !state.scrollableParent) {
			return;
		}
		const step = state.autoScrollStep
		if (step !== 0) {
			const maxScroll = state.scrollableParent.offsetHeight -
				window.innerHeight;
			const newScrollY = parseInt(Math.max(0,
				Math.min(maxScroll, window.scrollY + step)));
			const moveBy = newScrollY - window.scrollY;
			state.scrollableParent.scrollTo(window.scrollX, newScrollY);
			state.elementY += Math.floor(moveBy);
			if (state.element !== undefined) {
				state.element.style.top = `${state.elementY}px`;
			}
		}
	}, 10, state);
	const onup = function (state) {
		clearInterval(state.autoScrollInterval);
		state.element.classList.remove('drag-item');
		state.element.classList.add('moved-item');
		state.element.dispatchEvent(new Event('dragend'));
		setTimeout(() => {
			state.element.style.top = '0px';
		}, 20);
		document.removeEventListener('mousemove', state.mousemove);
		document.removeEventListener('mouseup', state.mouseup);
	}
	document.addEventListener('mousemove', state.mousemove);
	document.addEventListener('mouseup', state.mouseup);
}
	
fet.find = function() {
	if (arguments.length === 1) {
		return document.querySelector(arguments[0])
	} else {
		return arguments[0].querySelector(arguments[1])
	}
}

fet.findAll = function() {
	if (arguments.length === 1) {
		return [...document.querySelectorAll(arguments[0])]
	} else {
		return [...arguments[0].querySelectorAll(arguments[1])]
	}
}

fet.applyListChanges = function(arrNew, parentElem, createElemFunc) {
	const childByKeyBeforeUpdate = {};
	for (const child of parentElem.children) {
		const key = child.dataset.key;
		const offset = fet.impl.cumulativeOffset(child);
		childByKeyBeforeUpdate[key] = {
			offset: offset
		};
	}
	const isListInitialized =
				parentElem.dataset.listInitialized === 'true';
	const createElemFuncWrapper = item => {
		const element = createElemFunc(item);
		element.style.position = 'relative';
		element.style.top = '0px';
		element.addEventListener('transitionend', fet.impl.onTransitionEnd);
		if (isListInitialized) {
			element.classList.add('deleted-item');
			setTimeout(elem => {
				elem.classList.remove('deleted-item');
			}, 15, element);
		}
		return element;
	}
	const diff = fet.impl.applyListChangesBase(arrNew, parentElem,
																		createElemFuncWrapper, true);
	const childByKey = {};
	for (const child of parentElem.children) {
		const key = child.dataset.key;
		childByKey[key] = {
			element: child
		};
	}
	let shiftAllNext = false;
	for (const wrapper of diff) {
		if (wrapper.status === fet.impl.ItemStatus.Unchanged ||
				wrapper.status === fet.impl.ItemStatus.Moved) {
			const keyStr = wrapper.key.toString();
			const childInfo = childByKey[keyStr];
			const element = childInfo.element;
			if (element.classList.contains('deleted-item')) {
				shiftAllNext = true;
			}
			else if (shiftAllNext) {
				wrapper.status = fet.impl.ItemStatus.Moved;
			}
		}
	}
	for (const wrapper of diff) {
		const keyStr = wrapper.key.toString();
		const childInfo = childByKey[keyStr];
		const element = childInfo.element;
		if (wrapper.status === fet.impl.ItemStatus.Created) {
			// Moved to create func wrapper above
		} else if (wrapper.status === fet.impl.ItemStatus.Moved) {
			if (element.classList.contains('drag-item')) {
				continue;
			}
			const oldChildInfo = childByKeyBeforeUpdate[keyStr];
			const newTop = fet.impl.cumulativeOffset(element).top;
			const offset = oldChildInfo.offset.top - newTop -
						parseFloat(element.style.top);
			element.classList.remove('moved-item');
			element.style.top = `${offset}px`;
			setTimeout(elem => {
				elem.classList.add('moved-item');
			}, 5, element);
			setTimeout(elem => {
				elem.style.top = '0px';
			}, 10, element);
		} else if(wrapper.status === fet.impl.ItemStatus.Deleted) {
			const oldChildInfo = childByKeyBeforeUpdate[keyStr];
			const bounds = element.getBoundingClientRect();
			const compStyle = window.getComputedStyle(element);
			const hasTransition = compStyle.transition !== 'all 0s ease 0s';
			if (hasTransition) {
				element.classList.remove('moved-item');
				element.style.position = 'absolute';
				element.style.boxSizing = 'border-box';
				element.style.width = `${bounds.right - bounds.left}px`;
				element.style.top = `${oldChildInfo.offset.top}px`;
				setTimeout(elem => {
					elem.classList.add('deleted-item');
				}, 5, element);
			} else {
				fet.impl.removeElement(element);
			}
		}
	}
	setTimeout(() => {
		for (const wrapper of diff) {
			const keyStr = wrapper.key.toString();
			const childInfo = childByKey[keyStr];
			const element = childInfo.element;
			if(wrapper.status === fet.impl.ItemStatus.Unchanged ||
				 wrapper.status === fet.impl.ItemStatus.Moved) {
				if(element.classList.contains('deleted-item')) {
					element.style.position = 'relative';
					element.style.boxSizing = 'unset';
					element.style.width = 'unset';
					element.style.top = '0px';
					element.classList.remove('moved-item');
					element.classList.remove('deleted-item');
				}
			}
		}
	}, 5);
	if(!isListInitialized) {
		parentElem.dataset.listInitialized = 'true';
	}
}

fet.bindMany = function(pairs, func) {
	if (!pairs.length) {
		return;
	}
	const bindingInfos = [];
	let isFirst = true;
	for (const pair of pairs) {
		const object = pair[0];
		const property = pair[1];
		const propValue = `_${property}Value`;
		const propGetter = `_${property}Getter`;
		const propSetter = `_${property}Setter`;
		const propCallbacks = `_${property}Callbacks`;
		const callbackId = fet.impl.genRandomInt();
		const _freeze = fet.impl.freeze;
		object[propValue] = object[property];
		fet.impl.freeze(object[propValue]);
		if (propCallbacks in object) {
			object[propCallbacks][callbackId] = func;
		} else {
			object[propCallbacks] = {};
			object[propCallbacks][callbackId] = func;
			object[propGetter] = function() {
				return object[propValue];
			}
			object[propSetter] = function(val) {
				const oldVal = object[propValue];
				object[propValue] = val
				_freeze(object[propValue]);
				for (const callback of Object.values(object[propCallbacks])) {
					callback(val, oldVal);
				}
			}
			Object.defineProperty(object, property, {
				get: object[propGetter],
				set: object[propSetter]
			});
		}
		bindingInfos.push({
			callbackId: callbackId,
			callbacks: object[propCallbacks]
		});
		if (isFirst) {
			isFirst = false;
			func(object[propValue], null);
		}
	}
	return bindingInfos;
}

fet.bind = function(object, property, func) {
	return fet.bindMany([[object, property]], func);
}

fet.unbind = function(bindings) {
	if (!bindings.length) {
		return;
	}
	if (Array.isArray(bindings[0])) {
		for (const bndGroup of bindings) {
			for (const bnd of bndGroup) {
				delete bnd.callbacks[bnd.callbackId];
			}
		}
	} else {
		for (const bnd of bindings) {
			delete bnd.callbacks[bnd.callbackId];
		}
	}
}

fet.unbindOnDestroy = function(element, bindings) {
	element.addEventListener(element, () => fet.unbind(bindings));
}

fet.makeDragOnHoldFunc = function(object, prop, element, delay = 325) {
	return ev => {
		const options = {};
		if (ev.type === 'mousedown') {
			Object.assign(options, {
				clientY: ev.clientY,
				pageY: ev.pageY
			});
		}
		const timer = setTimeout(() => {
			startDrag(object, prop, element, options);
		}, delay);
		const cancel = () => clearTimeout(timer);
		element.onmousemove = moveEvent => {
			Object.assign(options, {
				clientY: moveEvent.clientY,
				pageY: moveEvent.pageY
			});
		}
		element.onmouseup = cancel;
		element.onpointerleave = cancel;
	}
}

fet.dragOnHold = function(object, prop, element, delay = 325) {
	const func = fet.makeDragOnHoldFunc(object, prop, element, delay);
	element.onmousedown = func;
}

fet.startDrag = function() {
	return new fet.impl.Drag(...arguments);
}
