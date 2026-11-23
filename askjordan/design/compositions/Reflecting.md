# Reflecting

Every endpoint requires a valid session. The session resolves to the user who
owns the journal; callers cannot select another user.

An authenticated user [creates a reflection journal](reaction:Reflecting.CreateJournal).

```endpoints
Reflecting.CreateJournal at /reflecting/createjournal
```

An authenticated user [writes a reflection](reaction:Reflecting.Write)
for a story chapter.

```endpoints
Reflecting.Write at /reflecting/write
```

An authenticated user [edits an existing reflection](reaction:Reflecting.Edit).

```endpoints
Reflecting.Edit at /reflecting/edit
```

An authenticated user [reads a reflection](reaction:Reflecting.Read)
for a story.

```endpoints
Reflecting.Read at /reflecting/read
```

An authenticated user [retrieves their whole journal](reaction:Reflecting.GetJournal).

```endpoints
Reflecting.GetJournal at /reflecting/getjournal
```
