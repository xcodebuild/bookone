# Image

Bookone provide some features for image in book writing.

## Image Title

Use first argument in image markup to display a title for image. And image with title will have index like `Figure 1-2`， it's ordered within Chapter.

```markdown
![image alt](../public/images/safari.png "Image Title")
```

![image alt](../public/images/safari.png "Image Title | safari")

## Cite Image
You can give id to image with `|` after title.

```markdown
![image alt](../../doc/public/images/safari.png "Image Title | safari")
```

Then cite them with

```markdown
[](#safari)
```

It will be rendered as image index like `Figure 1-2`.

![image alt](https://i.postimg.cc/0zQTZkZx/5436704-50.png "xcodebuild | xcodebuild")

For example this is a reference for above `Image Title` image: [](#safari)

And this is a reference for `xcodebuild` image: [](#xcodebuild)

> Tip: Index for image would be miss in `start` mode at the moment, but it should works well in `build` mode.