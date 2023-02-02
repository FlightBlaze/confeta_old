export function $ () {
	if (arguments.length === 1) {
		return document.querySelector(arguments[0])
	} else {
		return arguments[0].querySelector(arguments[1])
	}
}

export function $$ () {
	if (arguments.length === 1) {
		return [...document.querySelectorAll(arguments[0])]
	} else {
		return [...arguments[0].querySelectorAll(arguments[1])]
	}
}

function calcItemOrder(wrapper) {
	if (wrapper.newIndex === null) {
		return wrapper.oldIndex;
	}
	return wrapper.newIndex;
}

function createEnum(values) {
  const enumObject = {};
  for (const val of values) {
    enumObject[val] = val;
  }
  return Object.freeze(enumObject);
}

const ItemStatus = createEnum([
	'Unchanged', 'Moved', 'Created', 'Deleted'
]);

function calcItemStatus(wrapper) {
	if (wrapper.oldIndex === null) {
		return ItemStatus.Created;
	}
	if (wrapper.newIndex === null) {
		return ItemStatus.Deleted;
	}
	if (wrapper.newIndex !== wrapper.oldIndex) {
		return ItemStatus.Moved;
	} else {
		return ItemStatus.Unchanged;
	}
}

function difference(arrNew, arrOld) {
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
			order: calcItemOrder(wrp)
		};
	}).sort((a,b) => a.order - b.order).map(wrp => {
		return {
			item: wrp.itself,
			status: calcItemStatus(wrp)
		};
	});
}

function differenceDom (arrNew, element) {
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
			order: calcItemOrder(wrp)
		};
	}).sort((a,b) => a.order - b.order).map(wrp => {
		return {
			key: wrp.key,
			item: wrp.itself,
			status: calcItemStatus(wrp)
		};
	});
}

function makeRandomColor() {
	return "#000000".replace(/0/g, function(){
		return (~~(Math.random()*16)).toString(16);
	});
}

function removeElement(element) {
	if (element.parentElement !== null) {
		const event = new Event('destroy');
		element.dispatchEvent(event);
	}
	element.remove();
}

function onTransitionEnd(ev) {
	if (ev.propertyName === 'top') {
		ev.target.classList.remove('moved-item');
	}
	if (ev.target.classList.contains('deleted-item')) {
		removeElement(ev.target);
	}
}

function insertChild(parent, child, index) {
	if (!index) {
		index = 0;
	}
  if (index >= parent.children.length) {
    parent.appendChild(child);
  } else {
    parent.insertBefore(child, parent.children[index]);
  }
}

function applyListChangesBase(arrNew, parentElem, createElemFunc,
	preserveDeletedElements = false) {
	const diff = differenceDom(arrNew, parentElem);
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
		if (wrapper.status === ItemStatus.Created) {
			const element = createElemFunc(wrapper.item);
			element.dataset.key = wrapper.item.key.toString();
			insertChild(parentElem, element, index);
			children.splice(index, 0, element);
		}
	}
	for (const i in diff) {
		const index = parseInt(i);
		const wrapper = diff[index];
		if(wrapper.status === ItemStatus.Moved) {
			const childInfo = childByKey[wrapper.item.key.toString()];
			insertChild(parentElem, childInfo.element, index);
		}
	}
	for (const wrapper in diff) {
		if(wrapper.status === ItemStatus.Deleted) {
			const childInfo = childByKey[wrapper.key.toString()];
			if (!preserveDeletedElements) {
				removeElement(childInfo.element);
			}
		}
	}
	return diff;
}

function cumulativeOffset(element) {
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

export function applyListChanges(arrNew, parentElem, createElemFunc) {
	const childByKeyBeforeUpdate = {};
	for (const child of parentElem.children) {
		const key = child.dataset.key;
		const offset = cumulativeOffset(child);
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
		element.addEventListener('transitionend', onTransitionEnd);
		if (isListInitialized) {
			element.classList.add('deleted-item');
			setTimeout(elem => {
				elem.classList.remove('deleted-item');
			}, 15, element);
		}
		return element;
	}
	const diff = applyListChangesBase(arrNew, parentElem,
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
		if (wrapper.status === ItemStatus.Unchanged ||
				 wrapper.status === ItemStatus.Moved) {
				const keyStr = wrapper.key.toString();
				const childInfo = childByKey[keyStr];
				const element = childInfo.element;
				if (element.classList.contains('deleted-item')) {
					shiftAllNext = true;
				}
				else if (shiftAllNext) {
					wrapper.status = ItemStatus.Moved;
				}
		}
	}
	for (const wrapper of diff) {
		const keyStr = wrapper.key.toString();
		const childInfo = childByKey[keyStr];
		const element = childInfo.element;
		if (wrapper.status === ItemStatus.Created) {
			// Moved to create func wrapper above
		} else if (wrapper.status === ItemStatus.Moved) {
			if (element.classList.contains('drag-item')) {
				continue;
			}
			const oldChildInfo = childByKeyBeforeUpdate[keyStr];
			const newTop = cumulativeOffset(element).top;
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
		} else if(wrapper.status === ItemStatus.Deleted) {
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
				removeElement(element);
			}
		}
	}
	setTimeout(() => {
		for (const wrapper of diff) {
			const keyStr = wrapper.key.toString();
			const childInfo = childByKey[keyStr];
			const element = childInfo.element;
			if(wrapper.status === ItemStatus.Unchanged ||
				 wrapper.status === ItemStatus.Moved) {
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

function freeze(object) {
	if (typeof object === 'object') {
		Object.freeze(object);
	}
}

function genRandomInt(min = 0, max = 2147483647) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min);
}

export function bindMany(pairs, func) {
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
		const callbackId = genRandomInt();
		const _freeze = freeze;
		object[propValue] = object[property];
		freeze(object[propValue]);
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

export function bind(object, property, func) {
	return bindMany([[object, property]], func);
}

export function unbind(bindings) {
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

export function unbindOnDestroy(element, bindings) {
	element.addEventListener(element, () => unbind(bindings));
}

export function makeDragOnHoldFunc(object, prop, element, delay = 325) {
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

export function dragOnHold(object, prop, element, delay = 325) {
	const func = makeDragOnHoldFunc(object, prop, element, delay);
	element.onmousedown = func;
}

function getScrollableParent(node) {
  if (node == null) {
    return null;
  }
  if (node.scrollHeight > node.clientHeight) {
    return node;
  } else {
    return getScrollableParent(node.parentNode);
  }
}

function Drag() {
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
		elementPos: cumulativeOffset(element),
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
		scrollableParent: getScrollableParent(element)
	};
	state.offsetY = pageY - state.elementPos.top;
	element.style.position = 'relative';
	element.style.left = '0px';
	element.style.top = '0px';
	element.classList.add('drag-item');
	element.classList.remove('moved-item');
	const onmove = function (state, clientY, pageY) {
		const parent = state.element.parentElement;
		const parentOffset = cumulativeOffset(parent);
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
					state.elementIndex = index;
				}
				break;
			}
		}
		state.elementPos = cumulativeOffset(element);
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
		setTimeout(() => {
			state.element.style.top = '0px';
		}, 20);
		document.removeEventListener('mousemove', state.mousemove);
		document.removeEventListener('mouseup', state.mouseup);
	}
	document.addEventListener('mousemove', state.mousemove);
	document.addEventListener('mouseup', state.mouseup);
}

export function startDrag() {
	return new Drag(...arguments);
}
