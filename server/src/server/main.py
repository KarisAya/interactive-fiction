if __name__ == "__main__":
    import asyncio
    from interactive_fiction_server import Server

    asyncio.run(Server().run())
