# AvatarCustomizing

## Purpose

Allow a user to customize their avatar by equipping only items that have been granted to them.

## Principle

When an item is granted to a user, they can equip it in a slot and later retrieve what they are wearing. Only one item can be equipped in a slot at a time. Equipping another item in the same slot replaces the item already there. An item that has not been granted cannot be equipped.

## Types

```types
external User
  The account Authenticating returned.

opaque Item
  An item identifier supplied by the caller. No concept creates items yet.

Slot is HEAD or BODY
  Where one granted item can be worn.

opaque WornSet
  The items a user is wearing, each with its slot. Empty when the user holds items but wears none.
```

## State

```state
a set of Holdings with
  a user User
  an item Item

a set of Worn with
  a user User
  a slot Slot
  an item Item

Rule: a user holds a given item at most once, wears at most one item in a slot, and wears an item in at most one slot.
```

## Actions

```actions
grant (user: User, item: Item) : returns (user: User, item: Item)
  where user already holds item
  then
    refuses ALREADY_HOLDS "That item has already been granted."
  where user does not hold item
  then
    record that user holds item
    returns user, item

equip (user: User, item: Item, slot: Slot) : returns (user: User, slot: Slot, item: Item)
  where slot is not HEAD or BODY
  then
    refuses INVALID_SLOT "An item can be worn only on the head or the body."
  where user does not hold item
  then
    refuses NOT_HOLDING "That item has not been granted."
  where user holds item and slot is HEAD or BODY
  then
    remove item from any other slot
    make item the one worn in slot, replacing whatever item was already worn there
    returns user, slot, item

clear (user: User, slot: Slot) : returns (user: User, slot: Slot)
  where slot is not HEAD or BODY
  then
    refuses INVALID_SLOT "An item can be worn only on the head or the body."
  where user is not wearing an item in slot
  then
    refuses NOT_WEARING "Nothing is worn in that slot."
  where user is wearing an item in slot
  then
    remove it from slot
    returns user, slot

getEquipped (user: User) : returns (worn: WornSet)
  where user has no holdings
  then
    refuses NO_HOLDINGS "Nothing has been granted, so there is nothing to wear."
  where user has any holdings
  then
    returns worn
```

## Queries

```queries
```
